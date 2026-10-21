import type { ProviderResourceCapabilityCollection } from './provider-connections';

// Mirrors the discovery methods implemented by this backend's worker adapters.
export function backendProviderResourceCapabilities(): ProviderResourceCapabilityCollection {
  const domain = { capability: 'DOMAIN' as const, label: 'Domains' };
  const server = { capability: 'SERVER' as const, label: 'Servers' };
  const cloud = { capability: 'CLOUD_RESOURCE' as const, label: 'Cloud Resources' };
  return { items: [
    { providerKey: 'aws', resources: [cloud] },
    { providerKey: 'azure', resources: [cloud] },
    { providerKey: 'cloudflare', resources: [domain] },
    { providerKey: 'digitalocean', resources: [server] },
    { providerKey: 'gcp', resources: [cloud] },
    { providerKey: 'godaddy', resources: [domain] },
    { providerKey: 'hetzner', resources: [server] },
    { providerKey: 'hostinger', resources: [domain, { capability: 'SERVER', label: 'VPS' }] },
    { providerKey: 'linode', resources: [server] },
    { providerKey: 'namecheap', resources: [domain] },
    { providerKey: 'vultr', resources: [server] },
  ] };
}
