export interface WhoisFreaksRegistrar {
  iana_id?: string;
  status?: string;
  registrar_name?: string;
  normalized_name?: string;
  rdap_server?: string;
  website_url?: string;
  email_address?: string;
  phone_number?: string;
}

export interface WhoisFreaksContact {
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

export interface WhoisFreaksResponse {
  status?: boolean;
  domain_name?: string;
  query_time?: string;
  domain_registered?: 'yes' | 'no' | string;
  create_date?: string;
  update_date?: string;
  expiry_date?: string;
  domain_registrar?: WhoisFreaksRegistrar;
  registrant_contact?: WhoisFreaksContact;
  administrative_contact?: WhoisFreaksContact;
  technical_contact?: WhoisFreaksContact;
  billing_contact?: WhoisFreaksContact;
  name_servers?: string[];
  domain_status?: string[];
  whois_raw_domain?: string;
  registry_data?: Record<string, unknown>;
  error?: string;
  message?: string;
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
  registrar: {
    name: string | null;
    ianaId: string | null;
    websiteUrl: string | null;
    email: string | null;
    phone: string | null;
  };
  registrant: WhoisFreaksContact | null;
  technicalContact: WhoisFreaksContact | null;
  administrativeContact: WhoisFreaksContact | null;
  nameservers: string[];
  statuses: string[];
  rawWhois: string | null;
  rawResponse?: WhoisFreaksResponse | undefined;
  savedToDatabase: boolean;
  retrievedAt: string;
}
