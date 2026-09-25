import type { InventoryResource } from '@/api/types';
import type { ResourceConfiguration, ResourceField } from '@/components/integration/InventoryWorkspace';
import { useEmailLabel } from '@/features/email-accounts/useEmailLabel';
import { useProviderLabels } from '@/features/provider-accounts/useProviderLabels';
import {
  SERVER_KIND_MAX_LENGTH,
  SERVER_KIND_PATTERN_SOURCE,
  validateServerKindInput,
} from '@/features/integration/server-kind';

const notes: ResourceField = { input: 'textarea', key: 'notes', label: 'Notes', nullable: true, list: false };
const ProviderLabel = ({ id, initialLabels }: { id: string; initialLabels: ReadonlyMap<string, string> }) => {
  const resolved = useProviderLabels([id]);
  return <span title={id}>{resolved.get(id) ?? initialLabels.get(id) ?? 'Resolving provider…'}</span>;
};
const providerRender = (labels: ReadonlyMap<string, string>) => (value: unknown) =>
  typeof value === 'string' ? <ProviderLabel id={value} initialLabels={labels} /> : <span className="text-outline">Unknown</span>;
const EmailLabel = ({ id }: { id: string }) => {
  const result = useEmailLabel(id);
  return (
    <span title={id}>
      {result.status === 'ready'
        ? result.label
        : result.status === 'resolving' ? 'Resolving email…' : 'Email reference unavailable'}
    </span>
  );
};
const emailRender = (value: unknown) =>
  typeof value === 'string' ? <EmailLabel id={value} /> : <span className="text-outline">Unknown</span>;

const DOMAIN_FORMAT_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const UUID_FORMAT_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateDomainInput(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return 'Domain name is required.';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('/')) {
    return 'Enter domain name without protocol (e.g. example.com).';
  }
  if (/\s/.test(trimmed)) {
    return 'Domain name cannot contain whitespace.';
  }
  if (!DOMAIN_FORMAT_REGEX.test(trimmed)) {
    return 'Please enter a valid domain name (e.g. example.com or app.internal.io).';
  }
  if (trimmed.length > 253) {
    return 'Domain name exceeds maximum length of 253 characters.';
  }
  return null;
}

function validateDateInput(value: string, fieldName: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) {
    return `Please select or enter a valid date for ${fieldName}.`;
  }
  return null;
}

function validateExpiresAtInput(value: string, allValues?: Record<string, string>): string | null {
  const dateError = validateDateInput(value, 'Expires at');
  if (dateError) return dateError;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (allValues?.registeredAt?.trim()) {
    const expTime = new Date(trimmed).getTime();
    const regTime = new Date(allValues.registeredAt.trim()).getTime();
    if (!isNaN(expTime) && !isNaN(regTime) && expTime <= regTime) {
      return 'Expiration date must be after registration date.';
    }
  }
  return null;
}

function validateRegisteredAtInput(value: string, allValues?: Record<string, string>): string | null {
  const dateError = validateDateInput(value, 'Registered at');
  if (dateError) return dateError;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (allValues?.expiresAt?.trim()) {
    const regTime = new Date(trimmed).getTime();
    const expTime = new Date(allValues.expiresAt.trim()).getTime();
    if (!isNaN(regTime) && !isNaN(expTime) && regTime >= expTime) {
      return 'Registration date must be before expiration date.';
    }
  }
  return null;
}

function validateUuidReference(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!UUID_FORMAT_REGEX.test(trimmed)) {
    return `${label} must be a valid UUID (e.g. 550e8400-e29b-41d4-a716-446655440000) or blank.`;
  }
  return null;
}

export function domainConfiguration(labels: ReadonlyMap<string, string>): ResourceConfiguration<'domains'> {
  return {
    description: 'Real workspace domain records. Status reflects expiry dates only; DNS, SSL, RDAP, monitoring, and pricing are not connected.',
    detailBase: '/domains',
    fields: [
      {
        key: 'domainName',
        label: 'Domain',
        placeholder: 'example.com',
        required: true,
        trimOnBlur: true,
        validate: validateDomainInput,
      },
      {
        helpText: 'Select date from the calendar.',
        input: 'date',
        key: 'expiresAt',
        label: 'Expires at (ISO)',
        nullable: true,
        validate: validateExpiresAtInput,
      },
      {
        input: 'select',
        key: 'autoRenew',
        label: 'Auto-renew',
        nullable: true,
        options: [{ label: 'Enabled', value: 'true' }, { label: 'Disabled', value: 'false' }],
        valueType: 'boolean',
      },
      {
        key: 'registrarProviderAccountId',
        label: 'Registrar account ID',
        nullable: true,
        placeholder: 'UUID (e.g. 550e8400-...)',
        render: providerRender(labels),
        trimOnBlur: true,
        validate: (val) => validateUuidReference(val, 'Registrar account ID'),
      },
      {
        key: 'dnsProviderAccountId',
        label: 'DNS provider account ID',
        nullable: true,
        placeholder: 'UUID (e.g. 550e8400-...)',
        render: providerRender(labels),
        trimOnBlur: true,
        validate: (val) => validateUuidReference(val, 'DNS provider account ID'),
      },
      {
        helpText: 'Select date from the calendar.',
        input: 'date',
        key: 'registeredAt',
        label: 'Registered at (ISO)',
        list: false,
        nullable: true,
        validate: validateRegisteredAtInput,
      },
      notes,
    ],
    resource: 'domains',
    singular: 'domain',
    title: 'My Domains',
  };
}

export function serverConfiguration(labels: ReadonlyMap<string, string>): ResourceConfiguration<'servers'> {
  return {
    description: 'Stored server inventory metadata. No live health, utilization, uptime, or billing data is available.',
    detailBase: '/servers',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'hostname', label: 'Hostname', nullable: true },
      {
        helpText: 'Not recorded when blank. Otherwise use a canonical key such as vps or virtual-private-server.',
        key: 'serverKind',
        label: 'Server kind',
        maxLength: SERVER_KIND_MAX_LENGTH,
        nullable: true,
        pattern: SERVER_KIND_PATTERN_SOURCE,
        placeholder: 'vps',
        trimOnBlur: true,
        validate: validateServerKindInput,
      },
      { key: 'region', label: 'Region', nullable: true },
      { key: 'primaryIp', label: 'Primary IP', nullable: true },
      { key: 'operatingSystem', label: 'Operating system', nullable: true, list: false },
      { key: 'providerAccountId', label: 'Provider account ID', nullable: true, list: false, render: providerRender(labels) },
      notes,
    ],
    resource: 'servers', singular: 'server', title: 'VPS & Servers',
  };
}

const applicationKinds = ['WEBSITE', 'WEB_APPLICATION', 'API', 'BACKEND_SERVICE', 'MOBILE_APPLICATION', 'OTHER'].map((value) => ({ label: value.split('_').join(' '), value }));
export const applicationConfiguration: ResourceConfiguration<'applications'> = {
  description: 'Stored application inventory and structural mappings. Runtime health, stack detection, ports, repositories, and SSL are not connected.',
  detailBase: '/websites',
  fields: [
    { key: 'name', label: 'Name', required: true },
    { input: 'select', key: 'kind', label: 'Kind', options: applicationKinds, required: true },
    { key: 'primaryUrl', label: 'Primary URL', nullable: true },
    { key: 'projectId', label: 'Project ID', nullable: true },
    { key: 'primaryDomainId', label: 'Primary domain ID', nullable: true },
    notes,
  ],
  resource: 'applications', singular: 'application', title: 'Websites & Applications',
};

export const providerConfiguration: ResourceConfiguration<'provider-accounts'> = {
  description: 'Provider account records. Asset totals, billing, and live synchronization are unavailable.',
  detailBase: '/accounts',
  fields: [
    { key: 'label', label: 'Account label', required: true },
    { key: 'providerKey', label: 'Provider key', required: true, placeholder: 'example-provider' },
    { key: 'externalAccountId', label: 'External account ID', nullable: true },
    { key: 'loginEmailAccountId', label: 'Login email account', nullable: true, render: emailRender },
    notes,
  ],
  resource: 'provider-accounts', singular: 'provider account', title: 'Provider Accounts',
};

export const emailConfiguration: ResourceConfiguration<'email-accounts'> = {
  description: 'Stored email account references used to map provider logins. No mailbox access or credentials are stored.',
  fields: [
    { key: 'email', label: 'Email', required: true },
    { key: 'label', label: 'Label', nullable: true },
    notes,
  ],
  resource: 'email-accounts', singular: 'email account', title: 'Email Accounts',
};

export const projectConfiguration: ResourceConfiguration<'projects'> = {
  description: 'Project records used for application and graph organization.',
  fields: [{ key: 'name', label: 'Name', required: true }, { input: 'textarea', key: 'description', label: 'Description', nullable: true }],
  resource: 'projects', singular: 'project', title: 'Projects',
};

export function cloudConfiguration(labels: ReadonlyMap<string, string>): ResourceConfiguration<'cloud-resources'> {
  return {
    description: 'Cloud resource inventory metadata. Live provider state and utilization are unavailable.',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'resourceType', label: 'Resource type', required: true },
      { key: 'providerAccountId', label: 'Provider account ID', required: true, render: providerRender(labels) },
      { key: 'region', label: 'Region', nullable: true },
      { key: 'externalResourceId', label: 'External resource ID', nullable: true },
      notes,
    ],
    resource: 'cloud-resources', singular: 'cloud resource', title: 'Cloud Resources',
  };
}

export function graphKindResource(kind: string): InventoryResource | null {
  const resources: Record<string, InventoryResource> = {
    CLOUD_RESOURCE: 'cloud-resources', DOMAIN: 'domains', PROJECT: 'projects', SERVER: 'servers', WEBSITE_APPLICATION: 'applications',
  };
  return resources[kind] ?? null;
}
