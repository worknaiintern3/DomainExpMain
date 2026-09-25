import {
  domains,
  whoisRecords,
  type WhoisRecord,
} from '@domainpulse/database';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import type {
  NormalizedWhoisData,
  WhoisFreaksResponse,
} from './whois.types';

interface CachedEntry {
  data: NormalizedWhoisData;
  expiresAt: number;
}

const DEFAULT_API_KEY = 'ce2619a4ee0e49799a05b15e731ce193';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache to avoid exhausting API credits

@Injectable()
export class WhoisService {
  private readonly logger = new Logger(WhoisService.name);
  private readonly cache = new Map<string, CachedEntry>();

  constructor(private readonly databaseService: DatabaseService) {}

  private get apiKey(): string {
    return process.env.WHOISFREAKS_API_KEY || DEFAULT_API_KEY;
  }

  private normalizeDomain(input: string): string {
    const trimmed = input.trim().toLowerCase();
    const withoutProtocol = trimmed.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!withoutProtocol || !withoutProtocol.includes('.')) {
      throw new BadRequestException('Please provide a valid domain name (e.g. google.com)');
    }
    return withoutProtocol;
  }

  private calculateDaysRemaining(expiryStr?: string | null): number | null {
    if (!expiryStr) return null;
    const expiry = new Date(expiryStr).getTime();
    if (isNaN(expiry)) return null;
    return Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24));
  }

  private parseDate(dateStr?: string | null): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  async lookupLive(
    domainInput: string,
    workspaceId?: string,
    domainId?: string,
  ): Promise<NormalizedWhoisData> {
    const domainName = this.normalizeDomain(domainInput);
    const now = Date.now();

    // Check in-memory cache first
    const cached = this.cache.get(domainName);
    if (cached && cached.expiresAt > now) {
      this.logger.debug(`Returning cached WHOIS result for ${domainName}`);
      return cached.data;
    }

    const url = `https://api.whoisfreaks.com/v2.0/whois/live?apiKey=${encodeURIComponent(
      this.apiKey,
    )}&domainName=${encodeURIComponent(domainName)}&format=json`;

    let responseJson: WhoisFreaksResponse;
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      responseJson = (await response.json()) as WhoisFreaksResponse;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error querying WhoisFreaks API for ${domainName}: ${msg}`);
      throw new InternalServerErrorException(`Failed to reach WhoisFreaks API: ${msg}`);
    }

    if (responseJson.error || (responseJson.message && !responseJson.status)) {
      this.logger.warn(`WhoisFreaks error for ${domainName}: ${responseJson.message || responseJson.error}`);
    }

    const isRegistered = responseJson.domain_registered === 'yes';
    const regDate = this.parseDate(responseJson.create_date);
    const expDate = this.parseDate(responseJson.expiry_date);
    const updDate = this.parseDate(responseJson.update_date);
    const daysRemaining = this.calculateDaysRemaining(responseJson.expiry_date);

    let recordId: string | null = null;
    let savedToDatabase = false;

    // Persist to database
    try {
      const db = this.databaseService.database;

      const inserted = await db
        .insert(whoisRecords)
        .values({
          workspaceId: workspaceId || null,
          domainId: domainId || null,
          domainName,
          normalizedDomainName: domainName,
          isRegistered,
          queryTime: responseJson.query_time || new Date().toISOString(),
          registeredAt: regDate,
          expiresAt: expDate,
          updatedDate: updDate,
          registrarName: responseJson.domain_registrar?.registrar_name || null,
          registrarIanaId: responseJson.domain_registrar?.iana_id || null,
          registrarWebsite: responseJson.domain_registrar?.website_url || null,
          registrarEmail: responseJson.domain_registrar?.email_address || null,
          registrarPhone: responseJson.domain_registrar?.phone_number || null,
          registrantContact: responseJson.registrant_contact || null,
          technicalContact: responseJson.technical_contact || null,
          administrativeContact: responseJson.administrative_contact || null,
          nameservers: responseJson.name_servers || [],
          statuses: responseJson.domain_status || [],
          rawWhois: responseJson.whois_raw_domain || null,
          rawResponse: responseJson,
          retrievedAt: new Date(),
        })
        .returning({ id: whoisRecords.id });

      recordId = inserted[0]?.id ?? null;
      savedToDatabase = true;

      // If domainId was provided, or if domain exists in workspace, sync dates to domains table
      if (domainId && workspaceId) {
        await db
          .update(domains)
          .set({
            ...(regDate ? { registeredAt: regDate } : {}),
            ...(expDate ? { expiresAt: expDate } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(domains.workspaceId, workspaceId), eq(domains.id, domainId)));
      } else if (workspaceId) {
        // Try matching by normalizedDomainName in workspace
        const matchingDomain = await db
          .select({ id: domains.id })
          .from(domains)
          .where(and(eq(domains.workspaceId, workspaceId), eq(domains.normalizedDomainName, domainName)))
          .limit(1);

        if (matchingDomain[0]?.id) {
          await db
            .update(domains)
            .set({
              ...(regDate ? { registeredAt: regDate } : {}),
              ...(expDate ? { expiresAt: expDate } : {}),
              updatedAt: new Date(),
            })
            .where(eq(domains.id, matchingDomain[0].id));
        }
      }
    } catch (dbError) {
      this.logger.error(`Failed to persist WHOIS record to database: ${dbError}`);
    }

    const normalized: NormalizedWhoisData = {
      id: recordId,
      domainName,
      isRegistered,
      queryTime: responseJson.query_time || new Date().toISOString(),
      registeredAt: responseJson.create_date || null,
      expiresAt: responseJson.expiry_date || null,
      updatedDate: responseJson.update_date || null,
      daysRemaining,
      registrar: {
        name: responseJson.domain_registrar?.registrar_name || null,
        ianaId: responseJson.domain_registrar?.iana_id || null,
        websiteUrl: responseJson.domain_registrar?.website_url || null,
        email: responseJson.domain_registrar?.email_address || null,
        phone: responseJson.domain_registrar?.phone_number || null,
      },
      registrant: responseJson.registrant_contact || null,
      technicalContact: responseJson.technical_contact || null,
      administrativeContact: responseJson.administrative_contact || null,
      nameservers: responseJson.name_servers || [],
      statuses: responseJson.domain_status || [],
      rawWhois: responseJson.whois_raw_domain || null,
      rawResponse: responseJson,
      savedToDatabase,
      retrievedAt: new Date().toISOString(),
    };

    // Cache the result
    this.cache.set(domainName, {
      data: normalized,
      expiresAt: now + CACHE_TTL_MS,
    });

    return normalized;
  }

  async getLatestStored(
    domainName: string,
    workspaceId?: string,
  ): Promise<NormalizedWhoisData | null> {
    const normalizedName = this.normalizeDomain(domainName);
    const db = this.databaseService.database;

    const rows = await db
      .select()
      .from(whoisRecords)
      .where(
        workspaceId
          ? and(eq(whoisRecords.workspaceId, workspaceId), eq(whoisRecords.normalizedDomainName, normalizedName))
          : eq(whoisRecords.normalizedDomainName, normalizedName),
      )
      .orderBy(desc(whoisRecords.retrievedAt))
      .limit(1);

    if (!rows[0]) return null;
    return this.mapDbRecordToNormalized(rows[0]);
  }

  async getHistory(workspaceId?: string, limit = 20): Promise<NormalizedWhoisData[]> {
    const db = this.databaseService.database;

    const rows = await db
      .select()
      .from(whoisRecords)
      .where(workspaceId ? eq(whoisRecords.workspaceId, workspaceId) : undefined)
      .orderBy(desc(whoisRecords.retrievedAt))
      .limit(limit);

    return rows.map((r) => this.mapDbRecordToNormalized(r));
  }

  async refreshDomainWhois(workspaceId: string, domainId: string): Promise<NormalizedWhoisData> {
    const db = this.databaseService.database;

    const domainRows = await db
      .select({ domainName: domains.domainName })
      .from(domains)
      .where(and(eq(domains.workspaceId, workspaceId), eq(domains.id, domainId)))
      .limit(1);

    if (!domainRows[0]) {
      throw new BadRequestException('Domain not found in workspace');
    }

    // Invalidate in-memory cache to force a fresh pull from WhoisFreaks
    this.cache.delete(domainRows[0].domainName.toLowerCase());

    return this.lookupLive(domainRows[0].domainName, workspaceId, domainId);
  }

  private mapDbRecordToNormalized(row: WhoisRecord): NormalizedWhoisData {
    const daysRemaining = this.calculateDaysRemaining(row.expiresAt?.toISOString());
    return {
      id: row.id,
      domainName: row.domainName,
      isRegistered: row.isRegistered,
      queryTime: row.queryTime,
      registeredAt: row.registeredAt?.toISOString() || null,
      expiresAt: row.expiresAt?.toISOString() || null,
      updatedDate: row.updatedDate?.toISOString() || null,
      daysRemaining,
      registrar: {
        name: row.registrarName,
        ianaId: row.registrarIanaId,
        websiteUrl: row.registrarWebsite,
        email: row.registrarEmail,
        phone: row.registrarPhone,
      },
      registrant: (row.registrantContact as any) || null,
      technicalContact: (row.technicalContact as any) || null,
      administrativeContact: (row.administrativeContact as any) || null,
      nameservers: row.nameservers,
      statuses: row.statuses,
      rawWhois: row.rawWhois,
      rawResponse: (row.rawResponse as any) || undefined,
      savedToDatabase: true,
      retrievedAt: row.retrievedAt.toISOString(),
    };
  }
}
