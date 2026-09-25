export interface WhoisContact {
  name?: string;
  company?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country_name?: string;
  country_code?: string;
  email_address?: string;
  phone_number?: string;
  fax_number?: string;
}

export interface WhoisRegistrar {
  name: string | null;
  ianaId: string | null;
  websiteUrl: string | null;
  email: string | null;
  phone: string | null;
}

export interface NormalizedWhoisData {
  id: string | null;
  domainName: string;
  isRegistered: boolean;
  queryTime: string | null;
  registeredAt: string | null;
  expiresAt: string | null;
  updatedDate: string | null;
  daysRemaining: number | null;
  registrar: WhoisRegistrar;
  registrant: WhoisContact | null;
  technicalContact: WhoisContact | null;
  administrativeContact: WhoisContact | null;
  nameservers: string[];
  statuses: string[];
  rawWhois: string | null;
  rawResponse?: Record<string, unknown> | undefined;
  savedToDatabase: boolean;
  retrievedAt: string;
}
