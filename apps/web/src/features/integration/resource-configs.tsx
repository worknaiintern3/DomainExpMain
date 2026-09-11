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

export function domainConfiguration(labels: ReadonlyMap<string, string>): ResourceConfiguration<'domains'> {
  return {
    description: 'Real workspace domain records. Status reflects expiry dates only; DNS, SSL, RDAP, monitoring, and pricing are not connected.',
    detailBase: '/domains',
    fields: [
      { key: 'domainName', label: 'Domain', required: true },
      { key: 'expiresAt', label: 'Expires at (ISO)', nullable: true },
      { input: 'select', key: 'autoRenew', label: 'Auto-renew', nullable: true, valueType: 'boolean', options: [{ label: 'Enabled', value: 'true' }, { label: 'Disabled', value: 'false' }] },
      { key: 'registrarProviderAccountId', label: 'Registrar account ID', nullable: true, render: providerRender(labels) },
      { key: 'dnsProviderAccountId', label: 'DNS provider account ID', nullable: true, render: providerRender(labels) },
      { key: 'registeredAt', label: 'Registered at (ISO)', nullable: true, list: false },
      notes,
    ],
    resource: 'domains', singular: 'domain', title: 'My Domains',
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
