import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  archiveInventory,
  createInventory,
  listInventory,
  probeApplicationUrl,
  updateInventory,
  type ApplicationProbeResult,
} from '@/api/inventory';
import type { Application, Domain, ProviderAccount, Server } from '@/api/types';
import { Button } from '@/components/common/Button';
import {
  InventoryState,
  ResourceFormModal,
  StatePanel,
} from '@/components/integration/InventoryWorkspace';
import { applicationConfiguration } from '@/features/integration/resource-configs';
import { useCursorInventory } from '@/hooks/useCursorInventory';

const kindLabel = (kind: Application['kind']) => kind.split('_').join(' ');

function extractHostname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const KIND_CONFIG: Record<
  Application['kind'],
  { icon: string; bg: string; text: string; border: string; badge: string; bgLine: string }
> = {
  WEBSITE: {
    icon: 'language',
    bg: 'from-sky-500/20 to-blue-600/20',
    text: 'text-sky-600 dark:text-sky-400',
    border: 'border-sky-500/30',
    badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20',
    bgLine: 'from-sky-500 via-blue-500 to-indigo-500',
  },
  WEB_APPLICATION: {
    icon: 'web',
    bg: 'from-emerald-500/20 to-teal-600/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20',
    bgLine: 'from-emerald-500 via-teal-500 to-cyan-500',
  },
  API: {
    icon: 'api',
    bg: 'from-purple-500/20 to-violet-600/20',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/30',
    badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20',
    bgLine: 'from-purple-500 via-violet-500 to-indigo-500',
  },
  BACKEND_SERVICE: {
    icon: 'dns',
    bg: 'from-amber-500/20 to-orange-600/20',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20',
    bgLine: 'from-amber-500 via-orange-500 to-yellow-500',
  },
  MOBILE_APPLICATION: {
    icon: 'smartphone',
    bg: 'from-rose-500/20 to-pink-600/20',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/30',
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20',
    bgLine: 'from-rose-500 via-pink-500 to-purple-500',
  },
  OTHER: {
    icon: 'deployed_code',
    bg: 'from-slate-500/20 to-gray-600/20',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-500/30',
    badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20',
    bgLine: 'from-slate-500 via-gray-500 to-zinc-500',
  },
};

/** Returns a deterministic color config for a given account label */
const ACCOUNT_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {};
const PALETTE = [
  { bg: 'bg-violet-500/10', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500', border: 'border-violet-500/20' },
  { bg: 'bg-rose-500/10', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500', border: 'border-rose-500/20' },
  { bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', border: 'border-amber-500/20' },
  { bg: 'bg-teal-500/10', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500', border: 'border-teal-500/20' },
  { bg: 'bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-300', dot: 'bg-cyan-500', border: 'border-cyan-500/20' },
  { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-700 dark:text-fuchsia-300', dot: 'bg-fuchsia-500', border: 'border-fuchsia-500/20' },
  { bg: 'bg-lime-500/10', text: 'text-lime-700 dark:text-lime-300', dot: 'bg-lime-500', border: 'border-lime-500/20' },
];
let paletteIdx = 0;

function accountColor(label: string, providerKey: string) {
  if (providerKey === 'aws') {
    return { bg: 'bg-orange-500/10', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500', border: 'border-orange-500/20' };
  }
  if (!ACCOUNT_COLORS[label]) {
    ACCOUNT_COLORS[label] = PALETTE[paletteIdx % PALETTE.length];
    paletteIdx += 1;
  }
  return ACCOUNT_COLORS[label];
}

function AppBrandIcon({ app, hostname, size = 'md' }: { app: Application; hostname: string | null; size?: 'sm' | 'md' }) {
  const isIp = Boolean(hostname && /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname));
  const config = isIp
    ? { icon: 'dns', bg: 'from-purple-500/20 to-indigo-600/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' }
    : KIND_CONFIG[app.kind] ?? KIND_CONFIG.WEBSITE;
  const initial = app.name.trim().charAt(0).toUpperCase() || 'W';

  if (size === 'sm') {
    return (
      <div className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br ${config.bg} ${config.border} shadow-micro`}>
        <span className={`text-[12px] font-bold ${config.text}`}>{initial}</span>
      </div>
    );
  }
  return (
    <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br ${config.bg} ${config.border} shadow-sm transition-transform group-hover:scale-105`}>
      <span className={`text-[17px] font-bold tracking-tight ${config.text}`}>{initial}</span>
      <span className={`material-symbols-outlined absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface-container-lowest border ${config.border} text-[10px] ${config.text} shadow-micro`} title={isIp ? 'Cloud Server / IP' : kindLabel(app.kind)}>
        {config.icon}
      </span>
    </div>
  );
}

interface ProbeState extends ApplicationProbeResult { loading?: boolean; }

interface AppInfraInfo {
  domain: Domain | null;
  server: Server | null;
  providerAccount: ProviderAccount | null;
}

function resolveInfra(
  app: Application,
  domainById: Map<string, Domain>,
  serverByIp: Map<string, Server>,
  serverByName: Map<string, Server>,
  allServers: Server[],
  providerById: Map<string, ProviderAccount>,
): AppInfraInfo {
  const hostname = extractHostname(app.primaryUrl);

  // 1. Resolve domain (check ID, URL hostname, or notes)
  let domain: Domain | null = null;
  if (app.primaryDomainId) domain = domainById.get(app.primaryDomainId) ?? null;
  if (!domain && hostname) {
    const cleanHost = hostname.toLowerCase().replace(/^www\./, '');
    for (const d of domainById.values()) {
      const dName = d.domainName.toLowerCase().replace(/^www\./, '');
      if (cleanHost === dName || cleanHost.endsWith('.' + dName)) {
        domain = d;
        break;
      }
    }
  }
  if (!domain && app.notes) {
    const lowerNotes = app.notes.toLowerCase();
    for (const d of domainById.values()) {
      if (lowerNotes.includes(d.domainName.toLowerCase())) {
        domain = d;
        break;
      }
    }
  }

  // 2. Resolve server (via IP/hostname in URL)
  let server: Server | null = null;
  if (hostname) {
    server = serverByIp.get(hostname) ?? serverByName.get(hostname.toLowerCase()) ?? null;
  }
  // Fallback: match by app name to server name
  if (!server) {
    server = serverByName.get(app.name.toLowerCase()) ?? null;
  }
  // Fallback: scan all servers — match notes against hostname/IP/name
  if (!server && app.notes) {
    const lowerNotes = app.notes.toLowerCase();
    for (const s of allServers) {
      if ((s.hostname && lowerNotes.includes(s.hostname.toLowerCase())) ||
          (s.primaryIp && lowerNotes.includes(s.primaryIp)) ||
          (s.name && lowerNotes.includes(s.name.toLowerCase()))) {
        server = s;
        break;
      }
    }
  }
  // Fallback: scan all servers — app URL hostname matches server hostname
  if (!server && hostname) {
    for (const s of allServers) {
      if (s.hostname && hostname.toLowerCase().includes(s.hostname.toLowerCase())) {
        server = s;
        break;
      }
    }
  }

  // 3. Resolve provider account — server takes priority over domain
  let providerAccount: ProviderAccount | null = null;
  if (server?.providerAccountId) {
    providerAccount = providerById.get(server.providerAccountId) ?? null;
  }
  if (!providerAccount && domain?.registrarProviderAccountId) {
    providerAccount = providerById.get(domain.registrarProviderAccountId) ?? null;
  }
  // Last resort: notes mention the account label
  if (!providerAccount && app.notes) {
    const lowerNotes = app.notes.toLowerCase();
    for (const pa of providerById.values()) {
      if (pa.label.length > 3 && lowerNotes.includes(pa.label.toLowerCase())) {
        providerAccount = pa;
        break;
      }
    }
  }

  return { domain, server, providerAccount };
}

export function expiryPresentation(value: string | null | undefined) {
  if (!value) return null;
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  const formattedDate = new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (days < 0) {
    return {
      label: `Expired ${Math.abs(days)}d ago`,
      formattedDate,
      days,
      badgeClass: 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400 font-semibold',
    };
  }
  if (days <= 30) {
    return {
      label: `${days}d left (${formattedDate})`,
      formattedDate,
      days,
      badgeClass: 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-400 font-bold animate-pulse',
    };
  }
  if (days <= 90) {
    return {
      label: `${days}d left (${formattedDate})`,
      formattedDate,
      days,
      badgeClass: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400 font-semibold',
    };
  }
  return {
    label: `Expires: ${formattedDate}`,
    formattedDate,
    days,
    badgeClass: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400 font-medium',
  };
}

/** Provider icon abbreviation */
function providerIcon(providerKey: string): string {
  if (providerKey === 'aws') return '☁';
  return '⚡';
}

function ProviderBadge({ account, compact = false }: { account: ProviderAccount | null; compact?: boolean }) {
  if (!account) return null;
  const col = accountColor(account.label, account.providerKey);
  const providerName = account.providerKey === 'aws' ? 'AWS' : 'Hostinger';
  const icon = providerIcon(account.providerKey);
  const displayLabel = account.label === providerName ? providerName : account.label;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${col.bg} ${col.text} ${col.border}`}
      title={`${providerName} account: ${account.label}`}
    >
      <span className="shrink-0 text-[10px] leading-none">{icon}</span>
      {!compact && (
        <span className="truncate max-w-[100px]">{displayLabel}</span>
      )}
    </span>
  );
}

function ServerBadge({ server }: { server: Server | null }) {
  if (!server) return null;
  return (
    <Link
      to="/servers"
      className="inline-flex items-center gap-1 rounded-md border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300 hover:underline"
      title={`${server.name} · ${server.primaryIp ?? ''}`}
    >
      <span className="material-symbols-outlined text-[11px]">dns</span>
      <span className="truncate max-w-[100px]">{server.name}</span>
      {server.primaryIp && <span className="font-mono opacity-70">({server.primaryIp})</span>}
    </Link>
  );
}

function DomainExpiryBadge({ expiresAt }: { expiresAt: string | null | undefined }) {
  const exp = expiryPresentation(expiresAt);
  if (!exp) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] ${exp.badgeClass}`}
      title={`Domain Expiration: ${exp.formattedDate} (${exp.days} days remaining)`}
    >
      <span className="material-symbols-outlined text-[11px]">schedule</span>
      <span>{exp.label}</span>
    </span>
  );
}

export const WebsitesPage: React.FC = () => {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'WEBSITE' | 'WEB_APPLICATION' | 'API'>('ALL');
  const [accountFilter, setAccountFilter] = useState<string>('ALL');
  const [serverFilter, setServerFilter] = useState<string>('ALL');
  const [groupBy, setGroupBy] = useState<'none' | 'account' | 'server'>('none');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [editing, setEditing] = useState<Application | 'create' | null>(null);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [probingAll, setProbingAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Infrastructure data
  const [domainById, setDomainById] = useState<Map<string, Domain>>(new Map());
  const [serverByIp, setServerByIp] = useState<Map<string, Server>>(new Map());
  const [serverByName, setServerByName] = useState<Map<string, Server>>(new Map());
  const [allServers, setAllServers] = useState<Server[]>([]);
  const [providerById, setProviderById] = useState<Map<string, ProviderAccount>>(new Map());

  // Live health state
  const [probeMap, setProbeMap] = useState<Record<string, ProbeState>>({});

  const list = useCursorInventory('applications', includeArchived);

  // Load domains, servers, provider accounts
  useEffect(() => {
    let active = true;
    const fetchRelations = async () => {
      try {
        const [domainsRes, serversRes, providersRes] = await Promise.all([
          listInventory('domains', { limit: 200 }),
          listInventory('servers', { limit: 100 }),
          listInventory('provider-accounts', { limit: 100 }),
        ]);
        if (!active) return;

        const dById = new Map<string, Domain>();
        for (const d of domainsRes.items) dById.set(d.id, d);
        setDomainById(dById);

        const sIp = new Map<string, Server>();
        const sName = new Map<string, Server>();
        for (const s of serversRes.items) {
          if (s.primaryIp) sIp.set(s.primaryIp, s);
          if (s.hostname) sIp.set(s.hostname.toLowerCase(), s);
          sName.set(s.name.toLowerCase(), s);
        }
        setServerByIp(sIp);
        setServerByName(sName);
        setAllServers(serversRes.items);

        const pById = new Map<string, ProviderAccount>();
        for (const p of providersRes.items) pById.set(p.id, p);
        setProviderById(pById);

      } catch {
        // Relational labels optional
      }
    };
    void fetchRelations();
    return () => { active = false; };
  }, []);

  // Compute infra per app
  const infraMap = useMemo(() => {
    const map = new Map<string, AppInfraInfo>();
    for (const app of list.items) {
      map.set(app.id, resolveInfra(app, domainById, serverByIp, serverByName, allServers, providerById));
    }
    return map;
  }, [list.items, domainById, serverByIp, serverByName, allServers, providerById]);


  const probeWebsite = useCallback(async (appId: string, url: string | null) => {
    if (!url) return;
    setProbeMap((prev) => ({
      ...prev,
      [appId]: { error: null, latencyMs: null, loading: true, online: false, ssl: url.startsWith('https://'), statusCode: null, title: null },
    }));
    try {
      const result = await probeApplicationUrl(url);
      setProbeMap((prev) => ({ ...prev, [appId]: { ...result, loading: false } }));
    } catch (err: unknown) {
      setProbeMap((prev) => ({
        ...prev,
        [appId]: { error: err instanceof Error ? err.message : 'Connection failed', latencyMs: null, loading: false, online: false, ssl: url.startsWith('https://'), statusCode: null, title: null },
      }));
    }
  }, []);

  const probeAll = useCallback(async (items: Application[]) => {
    const validItems = items.filter((item) => Boolean(item.primaryUrl));
    if (validItems.length === 0) return;
    setProbingAll(true);
    await Promise.all(validItems.map((item) => probeWebsite(item.id, item.primaryUrl)));
    setProbingAll(false);
  }, [probeWebsite]);

  useEffect(() => {
    if (list.items.length > 0 && Object.keys(probeMap).length === 0 && !probingAll) {
      void probeAll(list.items);
    }
  }, [list.items, probeAll, probeMap, probingAll]);

  const handleAutoDetectSync = async () => {
    setSyncing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const [domainsRes, serversRes] = await Promise.all([
        listInventory('domains', { limit: 200 }),
        listInventory('servers', { limit: 100 }),
      ]);
      const existingNames = new Set(list.items.map((a) => a.name.toLowerCase()));
      const existingUrls = new Set(list.items.map((a) => a.primaryUrl?.toLowerCase()).filter(Boolean));
      const existingDomainIds = new Set(list.items.map((a) => a.primaryDomainId).filter(Boolean));
      let importedCount = 0;

      for (const domain of domainsRes.items) {
        if (existingDomainIds.has(domain.id)) continue;
        const primaryUrl = `https://${domain.domainName}`;
        if (existingUrls.has(primaryUrl.toLowerCase())) continue;
        const cleanName = domain.domainName.replace(/^www\./, '').split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        if (existingNames.has(cleanName.toLowerCase())) continue;
        await createInventory('applications', { kind: 'WEBSITE', name: cleanName, notes: `Auto-detected from domain ${domain.domainName}`, primaryDomainId: domain.id, primaryUrl });
        existingNames.add(cleanName.toLowerCase());
        existingUrls.add(primaryUrl.toLowerCase());
        importedCount += 1;
      }

      for (const server of serversRes.items) {
        if (!server.primaryIp) continue;
        const serverUrl = `http://${server.primaryIp}`;
        if (existingUrls.has(serverUrl.toLowerCase()) || existingNames.has(server.name.toLowerCase())) continue;
        await createInventory('applications', { kind: 'API', name: server.name, notes: `Auto-detected from server ${server.name} (${server.region ?? 'cloud'})`, primaryUrl: serverUrl });
        existingNames.add(server.name.toLowerCase());
        existingUrls.add(serverUrl.toLowerCase());
        importedCount += 1;
      }

      await list.reload();
      setActionSuccess(importedCount > 0 ? `Successfully synced ${importedCount} new application${importedCount > 1 ? 's' : ''} from your infrastructure!` : 'All domains and servers are already mapped to applications!');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to auto-detect websites.');
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = (id: string, text: string | null) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
  };

  // Build account & server options for filters
  const accountOptions = useMemo(() => {
    const seen = new Map<string, ProviderAccount>();
    for (const app of list.items) {
      const infra = infraMap.get(app.id);
      if (infra?.providerAccount && !seen.has(infra.providerAccount.id)) {
        seen.set(infra.providerAccount.id, infra.providerAccount);
      }
    }
    return [...seen.values()];
  }, [list.items, infraMap]);

  const serverOptions = useMemo(() => {
    const seen = new Map<string, Server>();
    for (const app of list.items) {
      const infra = infraMap.get(app.id);
      if (infra?.server && !seen.has(infra.server.id)) {
        seen.set(infra.server.id, infra.server);
      }
    }
    return [...seen.values()];
  }, [list.items, infraMap]);

  const counts = useMemo(() => ({
    total: list.items.length,
    websites: list.items.filter((a) => a.kind === 'WEBSITE').length,
    webApps: list.items.filter((a) => a.kind === 'WEB_APPLICATION').length,
    apis: list.items.filter((a) => a.kind === 'API' || a.kind === 'BACKEND_SERVICE').length,
  }), [list.items]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return list.items.filter((app) => {
      if (categoryFilter === 'WEBSITE' && app.kind !== 'WEBSITE') return false;
      if (categoryFilter === 'WEB_APPLICATION' && app.kind !== 'WEB_APPLICATION') return false;
      if (categoryFilter === 'API' && app.kind !== 'API' && app.kind !== 'BACKEND_SERVICE') return false;

      const infra = infraMap.get(app.id);
      if (accountFilter !== 'ALL' && infra?.providerAccount?.id !== accountFilter) return false;
      if (serverFilter !== 'ALL' && infra?.server?.id !== serverFilter) return false;

      if (!query) return true;
      return [
        app.name,
        app.kind,
        app.primaryUrl,
        app.notes,
        infra?.domain?.domainName,
        infra?.server?.name,
        infra?.server?.primaryIp,
        infra?.providerAccount?.label,
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [categoryFilter, accountFilter, serverFilter, infraMap, list.items, search]);

  const inspected = list.items.find((item) => item.id === inspectedId) ?? null;
  const inspectedInfra = inspected ? (infraMap.get(inspected.id) ?? null) : null;

  const totalCount = list.items.length;
  const onlineCount = list.items.filter((item) => { const p = probeMap[item.id]; return p?.online || (p?.statusCode && p.statusCode >= 200 && p.statusCode < 400); }).length;
  const sslCount = list.items.filter((item) => { const p = probeMap[item.id]; return p?.ssl || item.primaryUrl?.startsWith('https://'); }).length;
  const mappedCount = list.items.filter((item) => Boolean(infraMap.get(item.id)?.server || infraMap.get(item.id)?.domain)).length;
  const healthPercent = totalCount > 0 ? Math.round((onlineCount / totalCount) * 100) : 100;

  const changeState = async (record: Application) => {
    setActionError(null);
    try {
      if (record.inventoryState === 'TRACKED') {
        await archiveInventory('applications', record.id);
        if (includeArchived) list.markArchived(record.id);
        else {
          list.remove(record.id);
          if (inspectedId === record.id) setInspectedId(null);
        }
      } else {
        list.upsert(await updateInventory('applications', record.id, { inventoryState: 'TRACKED' }));
      }
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'The application could not be updated.');
    }
  };

  // Grouping logic
  const groupedItems = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups = new Map<string, { label: string; items: Application[]; subtitle?: string; providerKey?: string }>();

    for (const app of visibleItems) {
      const infra = infraMap.get(app.id);
      let key: string;
      let label: string;
      let subtitle: string | undefined;
      let providerKey: string | undefined;

      if (groupBy === 'account') {
        if (infra?.providerAccount) {
          key = infra.providerAccount.id;
          const pk = infra.providerAccount.providerKey;
          const provider = pk === 'aws' ? 'AWS' : 'Hostinger';
          // Use account label as primary heading; show provider as subtitle
          label = infra.providerAccount.label === provider ? provider : infra.providerAccount.label;
          subtitle = provider;
          providerKey = pk;
        } else {
          key = '__unassigned__';
          label = 'Unassigned';
          subtitle = 'No account linked';
        }
      } else {
        if (infra?.server) {
          key = infra.server.id;
          label = infra.server.name;
          subtitle = infra.server.primaryIp ?? undefined;
          providerKey = infra?.providerAccount?.providerKey;
        } else {
          key = '__unassigned__';
          label = 'No Server Assigned';
        }
      }

      if (!groups.has(key)) groups.set(key, { label, items: [], subtitle, providerKey });
      groups.get(key)!.items.push(app);
    }
    return [...groups.values()];
  }, [groupBy, visibleItems, infraMap]);

  const renderCard = (app: Application) => {
    const probe = probeMap[app.id];
    const hostname = extractHostname(app.primaryUrl);
    const isSelected = inspectedId === app.id;
    const config = KIND_CONFIG[app.kind] ?? KIND_CONFIG.WEBSITE;
    const infra = infraMap.get(app.id);
    const isOnline = probe?.online || (probe?.statusCode && probe.statusCode >= 200 && probe.statusCode < 400);
    const isWarning = probe?.statusCode && (probe.statusCode === 401 || probe.statusCode === 403 || probe.statusCode === 404);

    return (
      <div
        key={app.id}
        className={`group relative flex flex-col justify-between rounded-2xl border bg-surface-container-lowest transition-all duration-300 ${
          isSelected ? 'border-primary ring-2 ring-primary/20 shadow-lg' : 'border-outline-variant/40 hover:border-primary/40 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-0.5'
        }`}
      >
        {/* Top color accent */}
        <div className={`h-1 w-full rounded-t-2xl bg-gradient-to-r ${config.bgLine}`} />

        <div className="p-5 flex flex-col flex-1">
          {/* Header: Icon + Name + Status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <AppBrandIcon app={app} hostname={hostname} size="md" />
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-base text-on-surface group-hover:text-primary transition-colors">
                  {app.name}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-secondary flex-wrap">
                  <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.badge}`}>
                    {kindLabel(app.kind)}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Health */}
            <div>
              {probe?.loading ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1 text-xs font-medium text-secondary animate-pulse">
                  <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                  Pinging…
                </span>
              ) : isOnline ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span>{probe?.statusCode ?? 200} Online</span>
                  {probe?.latencyMs != null && <span className="text-[10px] font-mono text-emerald-600/80">({probe.latencyMs}ms)</span>}
                </span>
              ) : isWarning ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>{probe?.statusCode} Response</span>
                  {probe?.latencyMs != null && <span className="text-[10px] font-mono text-amber-600/80">({probe.latencyMs}ms)</span>}
                </span>
              ) : probe?.error ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <span>Offline</span>
                </span>
              ) : (
                <button type="button" onClick={() => void probeWebsite(app.id, app.primaryUrl)} className="inline-flex items-center gap-1 rounded-full border border-outline-variant/60 bg-surface-container-low px-2.5 py-0.5 text-xs font-medium text-secondary hover:border-primary/40 hover:text-primary transition-all cursor-pointer">
                  <span className="material-symbols-outlined text-[13px]">network_ping</span>
                  <span>Ping</span>
                </button>
              )}
            </div>
          </div>

          {/* URL Row */}
          <div className="mt-3.5 flex items-center justify-between gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low/60 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              {probe?.ssl || app.primaryUrl?.startsWith('https://') ? (
                <span className="flex items-center text-emerald-600 text-xs font-medium" title="SSL Encrypted">
                  <span className="material-symbols-outlined text-[15px]">lock</span>
                </span>
              ) : (
                <span className="flex items-center text-amber-600 text-xs font-medium" title="Unencrypted HTTP">
                  <span className="material-symbols-outlined text-[15px]">lock_open</span>
                </span>
              )}
              <span className="truncate font-mono text-xs text-on-surface select-all">{app.primaryUrl ?? 'No URL configured'}</span>
            </div>
            {app.primaryUrl && (
              <button type="button" onClick={() => copyToClipboard(app.id, app.primaryUrl)} className="shrink-0 text-secondary hover:text-primary transition-colors p-0.5 rounded cursor-pointer" title={copiedId === app.id ? 'Copied!' : 'Copy URL'}>
                <span className="material-symbols-outlined text-[15px]">{copiedId === app.id ? 'check' : 'content_copy'}</span>
              </button>
            )}
          </div>

          {/* Page title snippet */}
          {probe?.title && (
            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-secondary italic border-l-2 border-primary/40 pl-2 py-0.5">
              <span className="truncate">&ldquo;{probe.title}&rdquo;</span>
            </div>
          )}

          {/* Infrastructure Tags */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            {/* Provider Account Badge */}
            <ProviderBadge account={infra?.providerAccount ?? null} />

            {/* Server Badge */}
            {infra?.server ? (
              <ServerBadge server={infra.server} />
            ) : null}

            {/* Domain Badge */}
            {infra?.domain && (
              <Link to="/domains" className="inline-flex items-center gap-1 rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 font-medium text-sky-700 dark:text-sky-400 hover:underline text-[10px]" title="Linked domain">
                <span className="material-symbols-outlined text-[11px]">language</span>
                <span className="truncate max-w-[100px]">{infra.domain.domainName}</span>
              </Link>
            )}

            <InventoryState state={app.inventoryState} />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 border-t border-outline-variant/30 bg-surface-container-low/30 px-5 py-3 rounded-b-2xl">
          {app.primaryUrl ? (
            <a href={app.primaryUrl} target="_blank" rel="noopener noreferrer" className="group/btn inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-primary/95 hover:to-indigo-500 transition-all hover:shadow hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
              <span>Open Website</span>
              <span className="material-symbols-outlined text-[14px] transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5">open_in_new</span>
            </a>
          ) : (
            <span className="text-xs text-secondary">No live endpoint</span>
          )}
          <div className="flex items-center gap-1">
            <button type="button" disabled={probe?.loading} onClick={() => void probeWebsite(app.id, app.primaryUrl)} className="flex h-7.5 w-7.5 items-center justify-center rounded-lg text-secondary hover:bg-surface-container hover:text-primary transition-colors disabled:opacity-50 cursor-pointer" title="Ping live status now">
              <span className={`material-symbols-outlined text-[16px] ${probe?.loading ? 'animate-spin' : ''}`}>sync</span>
            </button>
            <button type="button" onClick={() => setInspectedId((curr) => (curr === app.id ? null : app.id))} className={`flex h-7.5 items-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors cursor-pointer ${isSelected ? 'bg-primary text-white font-semibold' : 'text-secondary hover:bg-surface-container hover:text-on-surface'}`} title="View details">
              <span className="material-symbols-outlined text-[15px]">info</span>
              <span>Inspect</span>
            </button>
            <button type="button" onClick={() => setEditing(app)} className="flex h-7.5 w-7.5 items-center justify-center rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer" title="Edit application">
              <span className="material-symbols-outlined text-[15px]">edit</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderGroupHeader = (label: string, count: number, subtitle?: string, providerKey?: string) => {
    const isAws = providerKey === 'aws';
    const isUnassigned = label === 'Unassigned' || label === 'No Server Assigned';
    const headerCol = isAws
      ? { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', bar: 'from-orange-400 to-amber-400', ring: 'ring-orange-500/20' }
      : isUnassigned
        ? { bg: 'bg-slate-500/10', text: 'text-slate-500', bar: 'from-slate-400 to-gray-400', ring: 'ring-slate-500/20' }
        : { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', bar: 'from-violet-400 to-indigo-400', ring: 'ring-violet-500/20' };
    return (
      <div className="flex items-center gap-3 mb-5 mt-1">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${headerCol.bg} ring-1 ${headerCol.ring}`}>
          <span className={`material-symbols-outlined text-[22px] ${headerCol.text}`}>
            {isAws ? 'cloud' : isUnassigned ? 'help_outline' : 'bolt'}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lg text-on-surface leading-tight">{label}</h3>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${headerCol.bg} ${headerCol.text}`}>
              {count} service{count !== 1 ? 's' : ''}
            </span>
          </div>
          {subtitle && (
            <p className={`text-[11px] font-semibold uppercase tracking-wider mt-0.5 ${headerCol.text} opacity-70`}>
              {subtitle === 'Hostinger' ? '⚡ Hostinger' : subtitle === 'AWS' ? '☁ Amazon Web Services' : subtitle}
            </p>
          )}
        </div>
        <div className={`ml-2 h-0.5 flex-1 rounded-full bg-gradient-to-r ${headerCol.bar} opacity-30`} />
      </div>
    );
  };

  return (
    <div className="flex w-full flex-col gap-unit-lg">
      {/* Header */}
      <header className="flex flex-col gap-unit-md md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-indigo-600 to-indigo-700 text-white shadow-md shadow-primary/20">
              <span className="material-symbols-outlined text-[24px]">hub</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-on-surface">Websites &amp; Apps</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  {totalCount} Services
                </span>
              </div>
              <p className="mt-0.5 text-sm text-secondary">
                Live HTTP reachability, SSL certificates, and multi-account cloud topology
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" disabled={syncing} onClick={() => void handleAutoDetectSync()} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3.5 py-2 text-sm font-medium text-on-surface shadow-sm hover:border-primary/40 hover:bg-surface-container-low transition-all disabled:opacity-60 cursor-pointer" title="Auto-detect new websites from domains and servers">
            <span className={`material-symbols-outlined text-[18px] text-amber-500 ${syncing ? 'animate-spin' : ''}`}>bolt</span>
            <span>{syncing ? 'Detecting Services…' : 'Sync Infrastructure'}</span>
          </button>
          <button type="button" disabled={probingAll} onClick={() => void probeAll(visibleItems)} className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3.5 py-2 text-sm font-medium text-on-surface shadow-sm hover:border-primary/40 hover:bg-surface-container-low transition-all disabled:opacity-60 cursor-pointer" title="Ping all registered websites live">
            <span className={`material-symbols-outlined text-[18px] text-primary ${probingAll ? 'animate-spin' : ''}`}>sync</span>
            <span>{probingAll ? 'Pinging Services…' : 'Check Live Health'}</span>
          </button>
          <button type="button" onClick={() => setEditing('create')} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20 hover:from-primary/95 hover:to-indigo-500 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Add Service</span>
          </button>
        </div>
      </header>

      {/* Notifications */}
      {actionSuccess && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>
            <span className="font-medium">{actionSuccess}</span>
          </div>
          <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900 transition-colors p-1">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}
      {actionError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span className="font-medium">{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="text-error hover:opacity-80 transition-opacity p-1">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <section className="grid grid-cols-2 gap-unit-sm lg:grid-cols-4" aria-label="Website metrics overview">
        <div className="group relative overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-unit-md shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Total Services</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110"><span className="material-symbols-outlined text-[18px]">language</span></span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-on-surface">{totalCount}</span>
            <span className="text-xs text-secondary">monitored</span>
          </div>
          <p className="mt-1 text-xs text-secondary/80">Active portfolio endpoints</p>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-surface-container-lowest p-unit-md shadow-sm transition-all duration-300 hover:border-emerald-500/40 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Operational Health</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 transition-transform group-hover:scale-110"><span className="material-symbols-outlined text-[18px]">check_circle</span></span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{onlineCount}</span>
            <span className="text-xs text-secondary">/ {totalCount} reachable</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-surface-container-high overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${healthPercent}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{healthPercent}%</span>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-sky-500/20 bg-surface-container-lowest p-unit-md shadow-sm transition-all duration-300 hover:border-sky-500/40 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">SSL / TLS Secured</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 transition-transform group-hover:scale-110"><span className="material-symbols-outlined text-[18px]">lock</span></span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-on-surface">{sslCount}</span>
            <span className="text-xs text-secondary">encrypted</span>
          </div>
          <p className="mt-1 text-xs text-secondary/80">HTTPS secure certificates</p>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-violet-500/20 bg-surface-container-lowest p-unit-md shadow-sm transition-all duration-300 hover:border-violet-500/40 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">Infra Mapped</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 transition-transform group-hover:scale-110"><span className="material-symbols-outlined text-[18px]">hub</span></span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-on-surface">{mappedCount}</span>
            <span className="text-xs text-secondary">connected</span>
          </div>
          <p className="mt-1 text-xs text-secondary/80">{accountOptions.length} provider account{accountOptions.length !== 1 ? 's' : ''} · {serverOptions.length} server{serverOptions.length !== 1 ? 's' : ''}</p>
        </div>
      </section>

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-unit-sm shadow-sm">
        {/* Row 1: Category + Account + Server pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Category pills */}
          {(
            [
              { key: 'ALL', label: 'All', count: counts.total, active: 'bg-primary text-white shadow-sm' },
              { key: 'WEBSITE', label: 'Websites', count: counts.websites, active: 'bg-sky-600 text-white shadow-sm' },
              { key: 'WEB_APPLICATION', label: 'Web Apps', count: counts.webApps, active: 'bg-emerald-600 text-white shadow-sm' },
              { key: 'API', label: 'APIs & Servers', count: counts.apis, active: 'bg-purple-600 text-white shadow-sm' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCategoryFilter(cat.key as typeof categoryFilter)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${categoryFilter === cat.key ? cat.active : 'text-secondary hover:bg-surface-container hover:text-on-surface'}`}
            >
              <span>{cat.label}</span>
              <span className={`rounded-full px-1.5 text-[10px] ${categoryFilter === cat.key ? 'bg-white/20' : 'bg-surface-container-high'}`}>{cat.count}</span>
            </button>
          ))}

          {/* Divider */}
          {accountOptions.length > 0 && <span className="mx-1 h-5 w-px bg-outline-variant/40" />}

          {/* Account filter pills */}
          {accountOptions.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setAccountFilter('ALL')}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${accountFilter === 'ALL' ? 'bg-surface-container-high text-on-surface ring-1 ring-outline-variant/60' : 'text-secondary hover:bg-surface-container hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-[13px]">account_tree</span>
                <span>All Accounts</span>
              </button>
              {accountOptions.map((pa) => {
                const col = accountColor(pa.label, pa.providerKey);
                const providerName = pa.providerKey === 'aws' ? 'AWS' : 'Hostinger';
                const icon = pa.providerKey === 'aws' ? '☁' : '⚡';
                // For Hostinger accounts, show just the label; for AWS show 'AWS'
                const displayLabel = pa.label === providerName ? providerName : pa.label;
                const isActive = accountFilter === pa.id;
                return (
                  <button
                    key={pa.id}
                    type="button"
                    onClick={() => setAccountFilter(isActive ? 'ALL' : pa.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border ${
                      isActive ? `${col.bg} ${col.text} ${col.border} shadow-sm ring-1 ring-current/20` : 'border-transparent text-secondary hover:bg-surface-container hover:text-on-surface'
                    }`}
                    title={`Filter by ${providerName}: ${pa.label}`}
                  >
                    <span className="text-[11px] leading-none">{icon}</span>
                    <span className="max-w-[110px] truncate">{displayLabel}</span>
                    {isActive && <span className="material-symbols-outlined text-[11px]">check_circle</span>}
                  </button>
                );
              })}
            </>
          )}

          {/* Server filter pills */}
          {serverOptions.length > 0 && (
            <>
              <span className="mx-1 h-5 w-px bg-outline-variant/40" />
              <button
                type="button"
                onClick={() => setServerFilter('ALL')}
                className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${serverFilter === 'ALL' ? 'bg-surface-container-high text-on-surface ring-1 ring-outline-variant/60' : 'text-secondary hover:bg-surface-container hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-[13px]">dns</span>
                <span>All Servers</span>
              </button>
              {serverOptions.map((s) => {
                const isActive = serverFilter === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServerFilter(isActive ? 'ALL' : s.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border ${
                      isActive ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 shadow-sm' : 'border-transparent text-secondary hover:bg-surface-container hover:text-on-surface'
                    }`}
                    title={`${s.name}${s.primaryIp ? ` · ${s.primaryIp}` : ''}`}
                  >
                    <span className="material-symbols-outlined text-[13px]">dns</span>
                    <span className="truncate max-w-[120px]">{s.name}</span>
                    {s.primaryIp && <span className="font-mono text-[9px] opacity-70">{s.primaryIp}</span>}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Row 2: Search + Group By + View Mode */}
        <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/20 pt-2">
          <label className="relative min-w-[220px]">
            <span className="sr-only">Filter applications</span>
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-secondary">search</span>
            <input
              className="h-8.5 w-full rounded-xl border border-outline-variant/50 bg-surface-container-low pl-8.5 pr-8 text-xs text-on-surface placeholder:text-secondary/70 focus:bg-surface-container-lowest focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              placeholder="Filter by name, URL, domain, account, server…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface p-0.5">
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </label>

          {/* Group By */}
          <div className="flex items-center gap-1 rounded-xl border border-outline-variant/40 bg-surface-container-low p-0.5">
            {(
              [
                { key: 'none', icon: 'dashboard', label: 'No Group' },
                { key: 'account', icon: 'account_tree', label: 'By Account' },
                { key: 'server', icon: 'dns', label: 'By Server' },
              ] as const
            ).map((g) => (
              <button
                key={g.key}
                type="button"
                title={`Group ${g.label}`}
                onClick={() => setGroupBy(g.key)}
                className={`flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium transition-all cursor-pointer ${
                  groupBy === g.key ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold' : 'text-secondary hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{g.icon}</span>
                <span>{g.label}</span>
              </button>
            ))}
          </div>

          <label className="flex h-8.5 items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant/40 bg-surface-container-low px-2.5 text-xs text-secondary cursor-pointer">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="rounded text-primary" />
            <span>Archived</span>
          </label>

          {/* Cards vs Table */}
          <div className="flex items-center rounded-xl border border-outline-variant/40 bg-surface-container-low p-0.5">
            <button type="button" className={`flex h-7.5 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold' : 'text-secondary hover:text-on-surface'}`} onClick={() => setViewMode('grid')}>
              <span className="material-symbols-outlined text-[15px]">grid_view</span>
              <span>Cards</span>
            </button>
            <button type="button" className={`flex h-7.5 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-all cursor-pointer ${viewMode === 'table' ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold' : 'text-secondary hover:text-on-surface'}`} onClick={() => setViewMode('table')}>
              <span className="material-symbols-outlined text-[15px]">table_rows</span>
              <span>Table</span>
            </button>
          </div>

          {/* Clear active filters */}
          {(accountFilter !== 'ALL' || serverFilter !== 'ALL' || search || categoryFilter !== 'ALL') && (
            <button type="button" onClick={() => { setAccountFilter('ALL'); setServerFilter('ALL'); setSearch(''); setCategoryFilter('ALL'); }} className="flex items-center gap-1 rounded-xl border border-outline-variant/40 bg-surface-container-low px-2.5 py-1.5 text-xs text-secondary hover:text-on-surface transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[13px]">filter_list_off</span>
              <span>Clear filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-start gap-unit-lg xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-unit-sm">
          {list.loading ? (
            <StatePanel icon="progress_activity" message="Loading websites and applications…" spinning />
          ) : list.error ? (
            <StatePanel icon="error" message={list.error} action={<Button onClick={list.reload}>Try again</Button>} />
          ) : visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-lowest/50 p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[36px]">hub</span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-on-surface">No Websites or Applications Found</h3>
              <p className="mt-1 max-w-md text-sm text-secondary">
                {search || accountFilter !== 'ALL' || serverFilter !== 'ALL' || categoryFilter !== 'ALL'
                  ? 'No records match your current filters.'
                  : 'Auto-detect and import websites from your tracked domains and servers with 1 click.'}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {(accountFilter !== 'ALL' || serverFilter !== 'ALL' || search || categoryFilter !== 'ALL') ? (
                  <Button variant="outline" iconLeading="filter_list_off" onClick={() => { setAccountFilter('ALL'); setServerFilter('ALL'); setSearch(''); setCategoryFilter('ALL'); }}>Clear Filters</Button>
                ) : (
                  <>
                    <Button variant="primary" iconLeading="bolt" onClick={() => void handleAutoDetectSync()}>Sync Infrastructure</Button>
                    <Button variant="outline" iconLeading="add" onClick={() => setEditing('create')}>Add Manually</Button>
                  </>
                )}
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            groupBy !== 'none' && groupedItems ? (
              /* Grouped view */
              <div className="flex flex-col gap-8">
                {groupedItems.map((group) => (
                  <div key={group.label}>
                    {renderGroupHeader(group.label, group.items.length, group.subtitle, group.providerKey)}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {group.items.map(renderCard)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Flat grid view */
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {visibleItems.map(renderCard)}
              </div>
            )
          ) : (
            /* Table View */
            <section className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="h-10 border-b border-outline-variant/30 bg-surface-container-low/60 text-[11px] font-semibold uppercase tracking-wider text-secondary">
                      <th className="px-unit-md">Application</th>
                      <th className="px-unit-sm">Type</th>
                      <th className="px-unit-sm">Provider Account</th>
                      <th className="px-unit-sm">Hosting Server</th>
                      <th className="px-unit-sm">Live Status</th>
                      <th className="px-unit-sm">Endpoint URL</th>
                      <th className="px-unit-md text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {visibleItems.map((application) => {
                      const probe = probeMap[application.id];
                      const infra = infraMap.get(application.id);
                      const isOnline = probe?.online || (probe?.statusCode && probe.statusCode >= 200 && probe.statusCode < 400);
                      return (
                        <tr
                          key={application.id}
                          className={`cursor-pointer transition-colors hover:bg-surface-container-low/70 ${inspectedId === application.id ? 'bg-primary/5' : ''}`}
                          onClick={() => setInspectedId((c) => (c === application.id ? null : application.id))}
                        >
                          <td className="px-unit-md py-3">
                            <div className="flex items-center gap-2.5">
                              <AppBrandIcon app={application} hostname={extractHostname(application.primaryUrl)} size="sm" />
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-on-surface truncate">{application.name}</p>
                                <p className="font-mono text-[10px] text-secondary">{application.id.slice(0, 8)}…</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-unit-sm py-3 text-xs text-secondary">
                            <span className="inline-flex rounded-md bg-surface-container px-2 py-0.5 font-medium">{kindLabel(application.kind)}</span>
                          </td>
                          <td className="px-unit-sm py-3">
                            {infra?.providerAccount ? (
                              <ProviderBadge account={infra.providerAccount} />
                            ) : (
                              <span className="text-xs text-secondary/60 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-unit-sm py-3">
                            {infra?.server ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs font-medium text-on-surface">{infra.server.name}</span>
                                {infra.server.primaryIp && <span className="text-[10px] font-mono text-secondary">{infra.server.primaryIp}</span>}
                              </div>
                            ) : infra?.domain ? (
                              <span className="text-xs text-sky-600 dark:text-sky-400">🌐 {infra.domain.domainName}</span>
                            ) : (
                              <span className="text-xs text-secondary/60 italic">No server</span>
                            )}
                          </td>
                          <td className="px-unit-sm py-3">
                            {probe?.loading ? (
                              <span className="inline-flex items-center gap-1 text-xs text-secondary"><span className="material-symbols-outlined animate-spin text-[12px]">progress_activity</span>Pinging</span>
                            ) : isOnline ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                {probe?.statusCode ?? 200} ({probe?.latencyMs ?? 0}ms)
                              </span>
                            ) : probe?.error ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                Offline
                              </span>
                            ) : (
                              <span className="text-xs text-secondary">Not checked</span>
                            )}
                          </td>
                          <td className="max-w-xs px-unit-sm py-3">
                            <span className="block truncate font-mono text-xs text-on-surface">{application.primaryUrl ?? 'Not set'}</span>
                          </td>
                          <td className="px-unit-md py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {application.primaryUrl && (
                                <a href={application.primaryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary/10 px-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">Open ↗</a>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => setEditing(application)}>Edit</Button>
                              <Button size="sm" variant="ghost" onClick={() => void changeState(application)}>
                                {application.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Pagination */}
          <footer className="flex items-center justify-between border-t border-outline-variant/30 pt-unit-sm text-xs text-secondary">
            <span>Showing {visibleItems.length} of {totalCount} records</span>
            {Boolean(list.nextCursor) && (
              <Button size="sm" variant="outline" disabled={list.loadingMore} onClick={list.loadMore}>
                {list.loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            )}
          </footer>
        </div>

        {/* Inspector Drawer */}
        {inspected && (
          <aside className="w-full shrink-0 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-md xl:sticky xl:top-4 xl:w-88 overflow-hidden" aria-label="Application inspector">
            <div className="h-1.5 bg-gradient-to-r from-primary via-emerald-500 to-sky-500" />
            <div className="p-unit-lg flex flex-col gap-unit-md">
              <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 pb-unit-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <AppBrandIcon app={inspected} hostname={extractHostname(inspected.primaryUrl)} size="md" />
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">Application Details</span>
                    <h2 className="mt-0.5 truncate text-base font-bold text-on-surface">{inspected.name}</h2>
                  </div>
                </div>
                <Button variant="ghost" size="sm" iconLeading="close" aria-label="Close application inspector" onClick={() => setInspectedId(null)} />
              </div>

              {/* Status badges row */}
              <div className="flex flex-wrap items-center gap-2">
                <InventoryState state={inspected.inventoryState} />
                <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-xs font-semibold text-secondary">{kindLabel(inspected.kind)}</span>
                {probeMap[inspected.id]?.online && (
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">● {probeMap[inspected.id]?.statusCode} OK</span>
                )}
              </div>

              <dl className="space-y-3 text-sm">
                {/* Live Endpoint */}
                <div className="rounded-xl bg-surface-container-low p-3">
                  <dt className="text-[11px] font-semibold uppercase text-secondary">Live Endpoint</dt>
                  <dd className="mt-1 break-all font-mono text-xs text-on-surface select-all">{inspected.primaryUrl ?? 'Not configured'}</dd>
                </div>

                {/* Provider Account */}
                {inspectedInfra?.providerAccount && (
                  <div className="rounded-xl bg-surface-container-low p-3">
                    <dt className="text-[11px] font-semibold uppercase text-secondary mb-1.5">Provider Account</dt>
                    <dd className="flex flex-col gap-1">
                      <ProviderBadge account={inspectedInfra.providerAccount} />
                      <span className="text-[10px] text-secondary font-mono mt-1">Provider: {inspectedInfra.providerAccount.providerKey}</span>
                    </dd>
                  </div>
                )}

                {/* Hosting Server */}
                {inspectedInfra?.server ? (
                  <div className="rounded-xl bg-surface-container-low p-3">
                    <dt className="text-[11px] font-semibold uppercase text-secondary mb-1.5">Hosting Server</dt>
                    <dd className="flex flex-col gap-1 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-on-surface">
                        <span className="material-symbols-outlined text-[14px] text-purple-500">dns</span>
                        {inspectedInfra.server.name}
                      </div>
                      {inspectedInfra.server.primaryIp && <span className="font-mono text-secondary">{inspectedInfra.server.primaryIp}</span>}
                      {inspectedInfra.server.hostname && inspectedInfra.server.hostname !== inspectedInfra.server.primaryIp && (
                        <span className="font-mono text-secondary text-[10px]">{inspectedInfra.server.hostname}</span>
                      )}
                      {inspectedInfra.server.region && <span className="text-secondary">Region: {inspectedInfra.server.region}</span>}
                      {inspectedInfra.server.operatingSystem && <span className="text-secondary">OS: {inspectedInfra.server.operatingSystem}</span>}
                      <Link to="/servers" className="mt-1 text-primary hover:underline text-[10px] font-medium">View server details →</Link>
                    </dd>
                  </div>
                ) : (
                  <div className="rounded-xl bg-surface-container-low p-3">
                    <dt className="text-[11px] font-semibold uppercase text-secondary">Hosting Server</dt>
                    <dd className="mt-1 text-sm text-secondary italic">No server assigned</dd>
                  </div>
                )}

                {/* Domain */}
                {inspectedInfra?.domain && (
                  <div className="rounded-xl bg-surface-container-low p-3">
                    <dt className="text-[11px] font-semibold uppercase text-secondary mb-1.5">Domain</dt>
                    <dd className="flex flex-col gap-1 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-on-surface">
                        <span className="material-symbols-outlined text-[14px] text-sky-500">language</span>
                        {inspectedInfra.domain.domainName}
                      </div>
                      {inspectedInfra.domain.expiresAt && (
                        <span className="text-secondary">
                          Expires: {new Date(inspectedInfra.domain.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                      <Link to="/domains" className="mt-1 text-primary hover:underline text-[10px] font-medium">View domain details →</Link>
                    </dd>
                  </div>
                )}

                {/* Page title */}
                {probeMap[inspected.id]?.title && (
                  <div className="rounded-xl bg-surface-container-low p-3">
                    <dt className="text-[11px] font-semibold uppercase text-secondary">Page Title Detected</dt>
                    <dd className="mt-1 text-sm italic text-on-surface">&ldquo;{probeMap[inspected.id]?.title}&rdquo;</dd>
                  </div>
                )}

                {/* Notes */}
                {inspected.notes && (
                  <div className="rounded-xl bg-surface-container-low p-3">
                    <dt className="text-[11px] font-semibold uppercase text-secondary">Notes &amp; Details</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-on-surface">{inspected.notes}</dd>
                  </div>
                )}
              </dl>

              {/* Inspector Actions */}
              <div className="flex flex-col gap-2 pt-2">
                {inspected.primaryUrl && (
                  <a href={inspected.primaryUrl} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-indigo-600 text-sm font-semibold text-white shadow-sm hover:from-primary/95 hover:to-indigo-500 transition-all cursor-pointer">
                    <span>Visit Live Site</span>
                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  </a>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => void probeWebsite(inspected.id, inspected.primaryUrl)}>Re-ping</Button>
                  <Button onClick={() => setEditing(inspected)}>Edit</Button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Edit/Create Modal */}
      {editing && (
        <ResourceFormModal
          config={applicationConfiguration}
          record={editing === 'create' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={list.upsert}
        />
      )}
    </div>
  );
};
