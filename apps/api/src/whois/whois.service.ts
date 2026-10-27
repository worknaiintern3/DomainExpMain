import { randomUUID } from 'node:crypto';
import * as dnsPromises from 'node:dns/promises';

import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import type {
  NormalizedWhoisData,
  WhoisFreaksResponse,
  WhoisFreaksDnsResponse,
  WhoisFreaksSslResponse,
  WhoisFreaksHistoricalResponse,
  WhoisFreaksAvailabilityResponse,
} from './whois.types';

interface CachedEntry {
  data: NormalizedWhoisData;
  expiresAt: number;
}

const DEFAULT_API_KEY = 'aa02fd191f444368a77d343ecf4c2994';
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
      this.logger.log(`Serving WHOIS for ${domainName} from in-memory cache`);
      return cached.data;
    }

    // Call WhoisFreaks live API
    const url = `https://api.whoisfreaks.com/v1.0/whois?apiKey=${encodeURIComponent(
      this.apiKey,
    )}&whois=live&domainName=${encodeURIComponent(domainName)}`;

    let responseJson: WhoisFreaksResponse | null = null;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        responseJson = (await response.json()) as WhoisFreaksResponse;
      } else {
        const errorText = await response.text();
        this.logger.warn(`WhoisFreaks API status ${response.status}: ${errorText}. Falling back to authoritative RDAP + DNS.`);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to fetch from WhoisFreaks: ${err?.message || err}. Falling back to authoritative RDAP + DNS.`);
    }

    if (!responseJson) {
      return this.lookupFromRdapAndDns(domainName, workspaceId, domainId);
    }

    const regData = ((responseJson as any).registry_data as any) || {};
    const effectiveRegistrar = responseJson.domain_registrar || regData.domain_registrar;

    let registrarName = effectiveRegistrar?.registrar_name || null;
    if (!registrarName) {
      const rawText = responseJson.whois_raw_domain || regData.whois_raw_registery || '';
      const match = rawText.match(/Registrar:\s*([^\r\n]+)/i);
      if (match && match[1]) {
        registrarName = match[1].trim();
      }
    }

    if (!registrarName && (domainName.endsWith('.com') || domainName.endsWith('.net'))) {
      try {
        const vRes = await fetch(`https://rdap.verisign.com/com/v1/domain/${encodeURIComponent(domainName)}`, {
          headers: { Accept: 'application/rdap+json, application/json' },
          signal: AbortSignal.timeout(2500),
        });
        if (vRes.ok) {
          const vData = (await vRes.json()) as any;
          const regEnt = vData.entities?.find((e: any) => Array.isArray(e.roles) && e.roles.includes('registrar'));
          if (regEnt?.vcardArray?.[1]) {
            const fn = regEnt.vcardArray[1].find((x: any) => x && x[0] === 'fn');
            if (fn && fn[3]) {
              registrarName = String(fn[3]).trim();
            }
          }
        }
      } catch {}
    }

    const registrarIanaId = effectiveRegistrar?.iana_id || null;
    const registrarWebsite = effectiveRegistrar?.website_url || null;
    const registrarEmail = effectiveRegistrar?.email_address || null;
    const registrarPhone = effectiveRegistrar?.phone_number || null;

    const rawCreate = responseJson.create_date || regData.create_date;
    const rawExpiry = responseJson.expiry_date || regData.expiry_date;
    const rawUpdate = responseJson.update_date || regData.update_date;

    const isRegistered =
      responseJson.status === true &&
      (responseJson.domain_registered === 'yes' ||
        responseJson.domain_registered === 'true' ||
        regData.domain_registered === 'yes' ||
        Boolean(rawExpiry));

    const regDate = this.parseDate(rawCreate);
    const expDate = this.parseDate(rawExpiry);
    const updDate = this.parseDate(rawUpdate);
    const daysRemaining = this.calculateDaysRemaining(rawExpiry);

    const nameservers: string[] = (responseJson.name_servers && responseJson.name_servers.length > 0)
      ? responseJson.name_servers
      : (regData.name_servers || []);

    let recordId: string | null = null;
    let savedToDatabase = false;

    // Persist to MongoDB
    try {
      const cols = this.databaseService.collections;
      if (cols) {
        const newId = randomUUID();
        await (cols.whoisRecords as any).insertOne({
          id: newId,
          workspaceId: workspaceId || null,
          domainId: domainId || null,
          domainName,
          normalizedDomainName: domainName,
          isRegistered,
          queryTime: responseJson.query_time || regData.query_time || new Date().toISOString(),
          registeredAt: regDate,
          expiresAt: expDate,
          updatedDate: updDate,
          registrarName,
          registrarIanaId,
          registrarWebsite,
          registrarEmail,
          registrarPhone,
          registrantContact: responseJson.registrant_contact || regData.registrant_contact || null,
          technicalContact: responseJson.technical_contact || regData.technical_contact || null,
          administrativeContact: responseJson.administrative_contact || regData.administrative_contact || null,
          nameservers,
          statuses: (responseJson.domain_status && responseJson.domain_status.length > 0)
            ? responseJson.domain_status
            : (regData.domain_status || []),
          rawWhois: responseJson.whois_raw_domain || regData.whois_raw_registery || null,
          rawResponse: responseJson,
          retrievedAt: new Date(),
        });
        recordId = newId;
        savedToDatabase = true;

        const domainFilter: any = {
          $or: [
            ...(domainId ? [{ id: domainId }] : []),
            { normalizedDomainName: domainName.toLowerCase().trim() },
            { domainName: domainName.trim() },
          ],
        };
        if (workspaceId) domainFilter.workspaceId = workspaceId;

        const notesStr = registrarName
          ? `Registrar: ${registrarName}${nameservers.length ? ` | Nameservers: ${nameservers.join(', ')}` : ''}`
          : undefined;

        await (cols.domains as any).updateMany(
          domainFilter,
          {
            $set: {
              ...(regDate ? { registeredAt: regDate } : {}),
              ...(expDate ? { expiresAt: expDate } : {}),
              ...(notesStr ? { notes: notesStr } : {}),
              updatedAt: new Date(),
            },
          },
        );
      }
    } catch (dbError) {
      this.logger.error(`Failed to persist WHOIS record to database: ${dbError}`);
    }

    const normalized: NormalizedWhoisData = {
      id: recordId,
      domainName,
      isRegistered,
      queryTime: responseJson.query_time || regData.query_time || new Date().toISOString(),
      registeredAt: rawCreate || null,
      expiresAt: rawExpiry || null,
      updatedDate: rawUpdate || null,
      daysRemaining,
      registrar: {
        name: registrarName,
        ianaId: registrarIanaId,
        websiteUrl: registrarWebsite,
        email: registrarEmail,
        phone: registrarPhone,
      },
      registrant: (responseJson.registrant_contact as any) || (regData.registrant_contact as any) || null,
      technicalContact: (responseJson.technical_contact as any) || (regData.technical_contact as any) || null,
      administrativeContact: (responseJson.administrative_contact as any) || (regData.administrative_contact as any) || null,
      nameservers,
      statuses: (responseJson.domain_status && responseJson.domain_status.length > 0)
        ? responseJson.domain_status
        : (regData.domain_status || []),
      rawWhois: responseJson.whois_raw_domain || regData.whois_raw_registery || null,
      rawResponse: responseJson,
      savedToDatabase,
      retrievedAt: new Date().toISOString(),
    };

    this.cache.set(domainName, {
      data: normalized,
      expiresAt: now + CACHE_TTL_MS,
    });

    return normalized;
  }

  async getLastKnown(domainInput: string, workspaceId?: string): Promise<NormalizedWhoisData | null> {
    const normalizedName = this.normalizeDomain(domainInput);
    const cols = this.databaseService.collections;
    if (!cols) return null;
    const filter: any = { normalizedDomainName: normalizedName };
    if (workspaceId) filter.workspaceId = workspaceId;

    const row = await (cols.whoisRecords as any)
      .find(filter)
      .sort({ retrievedAt: -1 })
      .limit(1)
      .toArray();
    if (!row[0]) return null;
    return this.mapDbRecordToNormalized(row[0]);
  }

  async getHistory(workspaceId?: string, limit = 20): Promise<NormalizedWhoisData[]> {
    const cols = this.databaseService.collections;
    if (!cols) return [];
    const filter: any = {};
    if (workspaceId) filter.workspaceId = workspaceId;

    const rows = await (cols.whoisRecords as any)
      .find(filter)
      .sort({ retrievedAt: -1 })
      .limit(limit)
      .toArray();
    return rows.map((r: any) => this.mapDbRecordToNormalized(r));
  }

  async refreshDomainWhois(workspaceId: string, domainId: string): Promise<NormalizedWhoisData> {
    const cols = this.databaseService.collections;
    const domain = await cols?.domains.findOne({ workspaceId, id: domainId });
    if (!domain) {
      throw new BadRequestException('Domain not found in workspace');
    }
    const domainName = domain.domainName;

    this.cache.delete(domainName.toLowerCase());
    return this.lookupLive(domainName, workspaceId, domainId);
  }

  private mapDbRecordToNormalized(row: any): NormalizedWhoisData {
    const daysRemaining = this.calculateDaysRemaining(
      row.expiresAt instanceof Date ? row.expiresAt.toISOString() : row.expiresAt,
    );
    const regData = row.rawResponse?.registry_data || {};
    const effectiveRegistrar = row.rawResponse?.domain_registrar || regData.domain_registrar;

    let registrarName = row.registrarName || effectiveRegistrar?.registrar_name || null;
    if (!registrarName) {
      const rawText = row.rawWhois || row.rawResponse?.whois_raw_domain || regData.whois_raw_registery || '';
      const match = rawText.match(/Registrar:\s*([^\r\n]+)/i);
      if (match && match[1]) {
        registrarName = match[1].trim();
      }
    }

    const nameservers: string[] = (Array.isArray(row.nameservers) && row.nameservers.length > 0)
      ? row.nameservers
      : (regData.name_servers || []);

    return {
      id: row.id,
      domainName: row.domainName,
      isRegistered: row.isRegistered,
      queryTime: row.queryTime,
      registeredAt:
        row.registeredAt instanceof Date
          ? row.registeredAt.toISOString()
          : row.registeredAt || null,
      expiresAt:
        row.expiresAt instanceof Date
          ? row.expiresAt.toISOString()
          : row.expiresAt || null,
      updatedDate:
        row.updatedDate instanceof Date
          ? row.updatedDate.toISOString()
          : row.updatedDate || null,
      daysRemaining,
      registrar: {
        name: registrarName,
        ianaId: row.registrarIanaId || effectiveRegistrar?.iana_id || null,
        websiteUrl: row.registrarWebsite || effectiveRegistrar?.website_url || null,
        email: row.registrarEmail || effectiveRegistrar?.email_address || null,
        phone: row.registrarPhone || effectiveRegistrar?.phone_number || null,
      },
      registrant: (row.registrantContact as any) || (regData.registrant_contact as any) || null,
      technicalContact: (row.technicalContact as any) || (regData.technical_contact as any) || null,
      administrativeContact: (row.administrativeContact as any) || (regData.administrative_contact as any) || null,
      nameservers,
      statuses: row.statuses || regData.domain_status || [],
      rawWhois: row.rawWhois || regData.whois_raw_registery || null,
      rawResponse: (row.rawResponse as any) || undefined,
      savedToDatabase: true,
      retrievedAt:
        row.retrievedAt instanceof Date
          ? row.retrievedAt.toISOString()
          : new Date(row.retrievedAt).toISOString(),
    };
  }

  async lookupDnsLive(domainInput: string): Promise<WhoisFreaksDnsResponse> {
    const domainName = this.normalizeDomain(domainInput);
    const url = `https://api.whoisfreaks.com/v1.0/dns/live?apiKey=${encodeURIComponent(
      this.apiKey,
    )}&type=all&domainName=${encodeURIComponent(domainName)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        return (await response.json()) as WhoisFreaksDnsResponse;
      }
      const errText = await response.text();
      this.logger.warn(`WhoisFreaks DNS API status ${response.status}: ${errText}`);
    } catch (err: any) {
      this.logger.warn(`Failed to fetch DNS from WhoisFreaks: ${err?.message || err}`);
    }

    // Fallback: system DNS resolution
    try {
      const [a, aaaa, mx, txt, ns] = await Promise.allSettled([
        dnsPromises.resolve4(domainName),
        dnsPromises.resolve6(domainName),
        dnsPromises.resolveMx(domainName),
        dnsPromises.resolveTxt(domainName),
        dnsPromises.resolveNs(domainName),
      ]);
      const records: any[] = [];
      if (a.status === 'fulfilled') {
        for (const ip of a.value) records.push({ name: domainName, dnsType: 'A', address: ip, ttl: 300 });
      }
      if (aaaa.status === 'fulfilled') {
        for (const ip of aaaa.value) records.push({ name: domainName, dnsType: 'AAAA', address: ip, ttl: 300 });
      }
      if (mx.status === 'fulfilled') {
        for (const m of mx.value) records.push({ name: domainName, dnsType: 'MX', target: m.exchange, priority: m.priority, ttl: 300 });
      }
      if (txt.status === 'fulfilled') {
        for (const t of txt.value) records.push({ name: domainName, dnsType: 'TXT', text: t.join(' '), ttl: 300 });
      }
      if (ns.status === 'fulfilled') {
        for (const n of ns.value) records.push({ name: domainName, dnsType: 'NS', target: n, ttl: 300 });
      }
      return {
        domainName,
        queryTime: new Date().toISOString(),
        dnsTypes: { A: a.status === 'fulfilled' ? a.value.length : 0 },
        dnsRecords: records,
        status: true,
      };
    } catch {
      return { domainName, dnsRecords: [], status: false };
    }
  }

  async lookupSslLive(domainInput: string): Promise<WhoisFreaksSslResponse> {
    const domainName = this.normalizeDomain(domainInput);
    const url = `https://api.whoisfreaks.com/v1.0/ssl/live?apiKey=${encodeURIComponent(
      this.apiKey,
    )}&domainName=${encodeURIComponent(domainName)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        return (await response.json()) as WhoisFreaksSslResponse;
      }
    } catch (err: any) {
      this.logger.warn(`Failed to fetch SSL from WhoisFreaks: ${err?.message || err}`);
    }

    return { domainName, queryTime: new Date().toISOString(), sslCertificates: [] };
  }

  async lookupHistorical(domainInput: string): Promise<WhoisFreaksHistoricalResponse> {
    const domainName = this.normalizeDomain(domainInput);
    const url = `https://api.whoisfreaks.com/v1.0/whois?apiKey=${encodeURIComponent(
      this.apiKey,
    )}&whois=historical&domainName=${encodeURIComponent(domainName)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        return (await response.json()) as WhoisFreaksHistoricalResponse;
      }
    } catch (err: any) {
      this.logger.warn(`Failed to fetch historical WHOIS from WhoisFreaks: ${err?.message || err}`);
    }

    return { status: false, whois_domains_historical: [] };
  }

  async checkAvailability(
    query: string,
    tlds: string[],
  ): Promise<Array<{ domain: string; tld: string; available: boolean; nameservers: string[] }>> {
    const cleanQuery = query.trim().toLowerCase().replace(/^https?:\/\//, '');
    const firstSegment = cleanQuery.split('/')[0] ?? '';
    const base = firstSegment.replace(/\.[a-z0-9.]+$/i, '');
    if (!base) return [];

    const checks = tlds.map(async (rawTld) => {
      const tld = rawTld.startsWith('.') ? rawTld : `.${rawTld}`;
      const domain = `${base}${tld}`;

      // 1. Try WhoisFreaks live domain availability API
      try {
        const wfUrl = `https://api.whoisfreaks.com/v1.0/domain/availability?apiKey=${encodeURIComponent(
          this.apiKey,
        )}&domain=${encodeURIComponent(domain)}`;
        const wfRes = await fetch(wfUrl, { headers: { Accept: 'application/json' } });
        if (wfRes.ok) {
          const wfData = (await wfRes.json()) as WhoisFreaksAvailabilityResponse;
          if (typeof wfData.domainAvailability === 'boolean') {
            return {
              domain,
              tld,
              available: wfData.domainAvailability,
              nameservers: [],
            };
          }
        }
      } catch {}

      // 2. DNS Fallback check
      try {
        const [aRes, nsRes] = await Promise.allSettled([
          dnsPromises.resolve4(domain),
          dnsPromises.resolveNs(domain),
        ]);
        const hasA = aRes.status === 'fulfilled' && aRes.value && aRes.value.length > 0;
        const hasNs = nsRes.status === 'fulfilled' && nsRes.value && nsRes.value.length > 0;
        const isRegistered = hasA || hasNs;
        const nameservers = hasNs ? nsRes.value.map((n) => n.replace(/\.$/, '').toLowerCase()) : [];
        return {
          domain,
          tld,
          available: !isRegistered,
          nameservers,
        };
      } catch {
        return {
          domain,
          tld,
          available: true,
          nameservers: [],
        };
      }
    });

    return Promise.all(checks);
  }

  private async lookupFromRdapAndDns(
    domainName: string,
    workspaceId?: string,
    domainId?: string,
  ): Promise<NormalizedWhoisData> {
    const tld = domainName.split('.').pop() || 'com';
    let rdapUrl = `https://rdap.org/domain/${encodeURIComponent(domainName)}`;
    if (tld === 'com' || tld === 'net') {
      rdapUrl = `https://rdap.verisign.com/com/v1/domain/${encodeURIComponent(domainName)}`;
    } else if (tld === 'org') {
      rdapUrl = `https://rdap.publicinterestregistry.org/rdap/domain/${encodeURIComponent(domainName)}`;
    }

    let rdapData: any = null;
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(rdapUrl, {
        headers: { Accept: 'application/rdap+json, application/json' },
        signal: controller.signal,
      });
      clearTimeout(id);
      if (res.ok) {
        rdapData = await res.json();
      }
    } catch {}

    const [aRes, nsRes] = await Promise.allSettled([
      dnsPromises.resolve4(domainName),
      dnsPromises.resolveNs(domainName),
    ]);
    const nameservers: string[] = nsRes.status === 'fulfilled' ? nsRes.value.map((n) => n.replace(/\.$/, '').toLowerCase()) : [];
    const hasA = aRes.status === 'fulfilled' && aRes.value && aRes.value.length > 0;

    let createDate: string | null = null;
    let expiryDate: string | null = null;
    let updateDate: string | null = null;
    let registrarName: string | null = null;
    let registrarIanaId: string | null = null;
    let statuses: string[] = [];

    if (rdapData) {
      if (Array.isArray(rdapData.events)) {
        for (const ev of rdapData.events) {
          if (ev.eventAction === 'registration') createDate = ev.eventDate;
          if (ev.eventAction === 'expiration') expiryDate = ev.eventDate;
          if (ev.eventAction === 'last changed') updateDate = ev.eventDate;
        }
      }
      if (Array.isArray(rdapData.status)) {
        statuses = rdapData.status;
      }
      if (Array.isArray(rdapData.entities)) {
        for (const ent of rdapData.entities) {
          if (Array.isArray(ent.roles) && ent.roles.includes('registrar')) {
            if (Array.isArray(ent.vcardArray) && ent.vcardArray[1]) {
              const fn = ent.vcardArray[1].find((i: any) => i && i[0] === 'fn');
              if (fn && fn[3]) registrarName = String(fn[3]).trim();
            }
            if (!registrarName && ent.publicIds?.[0]?.identifier) {
              registrarName = String(ent.publicIds[0].identifier).trim();
            }
            if (!registrarName && ent.handle) {
              registrarName = String(ent.handle).trim();
            }
            if (ent.publicIds?.[0]?.identifier) {
              registrarIanaId = String(ent.publicIds[0].identifier).trim();
            }
          }
        }
      }
    }

    const isRegistered = Boolean(createDate || expiryDate || nameservers.length > 0 || hasA);
    const regDate = this.parseDate(createDate);
    const expDate = this.parseDate(expiryDate);
    const updDate = this.parseDate(updateDate);
    const daysRemaining = this.calculateDaysRemaining(expiryDate);

    let recordId: string | null = null;
    let savedToDatabase = false;

    try {
      const cols = this.databaseService.collections;
      if (cols) {
        const newId = randomUUID();
        await (cols.whoisRecords as any).insertOne({
          id: newId,
          workspaceId: workspaceId || null,
          domainId: domainId || null,
          domainName,
          normalizedDomainName: domainName,
          isRegistered,
          queryTime: new Date().toISOString(),
          registeredAt: regDate,
          expiresAt: expDate,
          updatedDate: updDate,
          registrarName: registrarName || (isRegistered ? 'Authoritative Registry' : null),
          registrarIanaId: registrarIanaId || null,
          registrarWebsite: null,
          registrarEmail: null,
          registrarPhone: null,
          registrantContact: null,
          technicalContact: null,
          administrativeContact: null,
          nameservers,
          statuses,
          rawWhois: null,
          rawResponse: rdapData || { status: isRegistered },
          retrievedAt: new Date(),
        });
        recordId = newId;
        savedToDatabase = true;

        if (domainId && workspaceId) {
          await (cols.domains as any).updateOne(
            { workspaceId, id: domainId },
            {
              $set: {
                ...(regDate ? { registeredAt: regDate } : {}),
                ...(expDate ? { expiresAt: expDate } : {}),
                updatedAt: new Date(),
              },
            },
          );
        }
      }
    } catch (dbError) {
      this.logger.error(`Failed to persist fallback WHOIS record to database: ${dbError}`);
    }

    const normalized: NormalizedWhoisData = {
      id: recordId,
      domainName,
      isRegistered,
      queryTime: new Date().toISOString(),
      registeredAt: createDate,
      expiresAt: expiryDate,
      updatedDate: updateDate,
      daysRemaining,
      registrar: {
        name: registrarName || (isRegistered ? 'Authoritative Registry' : null),
        ianaId: registrarIanaId,
        websiteUrl: null,
        email: null,
        phone: null,
      },
      registrant: null,
      technicalContact: null,
      administrativeContact: null,
      nameservers,
      statuses,
      rawWhois: null,
      rawResponse: rdapData || undefined,
      savedToDatabase,
      retrievedAt: new Date().toISOString(),
    };

    this.cache.set(domainName, {
      data: normalized,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return normalized;
  }
}
