import React, { useState, useEffect } from 'react';
import { WebsiteRecord, WebsiteEnvironment, WebsiteSslStatus } from '../websites.types';

interface WebsiteAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<WebsiteRecord>) => void;
  editWebsite?: WebsiteRecord | null;
}

export const WebsiteAddModal: React.FC<WebsiteAddModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editWebsite,
}) => {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [routeNote, setRouteNote] = useState('');
  const [environment, setEnvironment] = useState<WebsiteEnvironment>('Production');
  const [project, setProject] = useState('WorknAi');
  const [serverId, setServerId] = useState('prod-01');
  const [serverName, setServerName] = useState('Production VPS 01');
  const [serverProvider, setServerProvider] = useState('Hostinger');
  const [serverAccountEmail, setServerAccountEmail] = useState('infra@worknai.com');
  const [techStack, setTechStack] = useState('Next.js 14');
  const [port, setPort] = useState('3000');
  const [reverseProxy, setReverseProxy] = useState('Nginx');
  const [sslStatus, setSslStatus] = useState<WebsiteSslStatus>('healthy');
  const [sslLabel, setSslLabel] = useState('Recorded • Valid • 68d');
  const [notes, setNotes] = useState('');

  const serverOptions = [
    {
      id: 'prod-01',
      name: 'Production VPS 01',
      provider: 'Hostinger',
      email: 'infra@worknai.com',
      ip: '103.21.58.112',
    },
    {
      id: 'aibos',
      name: 'AI BOS Server',
      provider: 'DigitalOcean',
      email: 'servers@worknai.com',
      ip: '159.89.162.40',
    },
    {
      id: 'staging',
      name: 'AnyWork Staging Node',
      provider: 'Hostinger',
      email: 'infra@worknai.com',
      ip: '103.21.59.84',
    },
    {
      id: 'legacy',
      name: 'Legacy VPS',
      provider: 'Vultr',
      email: 'aman@gmail.com',
      ip: '45.76.180.25',
    },
    {
      id: 'analytics',
      name: 'Analytics Worker',
      provider: 'DigitalOcean',
      email: 'servers@worknai.com',
      ip: '139.59.34.19',
    },
    {
      id: 'hetzner',
      name: 'Backup Storage Box',
      provider: 'Hetzner',
      email: 'infra@worknai.com',
      ip: '168.119.82.10',
    },
  ];

  useEffect(() => {
    if (editWebsite) {
      setName(editWebsite.name);
      setDomain(editWebsite.domain);
      setRouteNote(editWebsite.routeNote);
      setEnvironment(editWebsite.environment);
      setProject(editWebsite.project);
      setServerId(editWebsite.serverId);
      setServerName(editWebsite.serverName);
      setServerProvider(editWebsite.serverProvider);
      setServerAccountEmail(editWebsite.serverAccountEmail);
      setTechStack(editWebsite.techStack);
      setPort(String(editWebsite.port));
      setReverseProxy(editWebsite.reverseProxy);
      setSslStatus(editWebsite.sslStatus);
      setSslLabel(editWebsite.sslLabel);
      setNotes(editWebsite.notes || '');
    } else {
      setName('');
      setDomain('');
      setRouteNote('+ www domain or route');
      setEnvironment('Production');
      setProject('WorknAi');
      setServerId('prod-01');
      setServerName('Production VPS 01');
      setServerProvider('Hostinger');
      setServerAccountEmail('infra@worknai.com');
      setTechStack('Next.js 14');
      setPort('3000');
      setReverseProxy('Nginx');
      setSslStatus('healthy');
      setSslLabel('Recorded • Valid • 68d');
      setNotes('');
    }
  }, [editWebsite, isOpen]);

  if (!isOpen) return null;

  const handleServerSelect = (sId: string) => {
    setServerId(sId);
    const selected = serverOptions.find((s) => s.id === sId);
    if (selected) {
      setServerName(selected.name);
      setServerProvider(selected.provider);
      setServerAccountEmail(selected.email);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const avatarLetter = name.trim().charAt(0).toUpperCase() || 'W';
    onSubmit({
      name,
      domain,
      routeNote,
      environment,
      project,
      serverId,
      serverName,
      serverProvider,
      serverAccountEmail,
      techStack,
      port: Number(port) || 3000,
      reverseProxy,
      sslStatus,
      sslLabel,
      sslDetails: `${sslLabel} • Stored Certificate Record`,
      avatarLetter,
      avatarBgColor:
        environment === 'Production'
          ? 'bg-primary-fixed'
          : environment === 'Staging'
          ? 'bg-tertiary-container'
          : 'bg-secondary-container',
      avatarTextColor:
        environment === 'Production'
          ? 'text-primary'
          : environment === 'Staging'
          ? 'text-on-tertiary-container'
          : 'text-on-secondary-container',
      ipAddress: serverOptions.find((s) => s.id === serverId)?.ip || '103.21.58.112',
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-unit-md animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-xl bg-surface-container-lowest rounded-xl shadow-2xl p-unit-xl flex flex-col gap-unit-md border border-outline-variant/40 z-10 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex flex-col">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              {editWebsite ? 'Edit Website & App Mapping' : 'Add Website / Application'}
            </h3>
            <p className="font-caption-xs text-caption-xs text-secondary">
              Track domain bindings, runtime ports, host servers, and reverse proxy routes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container text-secondary hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-unit-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
            {/* Website / App Name */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Application Display Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. WorknAi Website"
                required
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Primary Domain */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Primary Domain *
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. worknai.com"
                required
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Route Note */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Route / Subdomains
              </label>
              <input
                type="text"
                value={routeNote}
                onChange={(e) => setRouteNote(e.target.value)}
                placeholder="+ www.worknai.com"
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Environment */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Environment *
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as WebsiteEnvironment)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer border border-outline-variant/30"
              >
                <option value="Production">Production</option>
                <option value="Staging">Staging</option>
                <option value="Development">Development</option>
              </select>
            </div>

            {/* Hosted Server Mapping */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Hosted Server *
              </label>
              <select
                value={serverId}
                onChange={(e) => handleServerSelect(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer border border-outline-variant/30"
              >
                {serverOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.provider})
                  </option>
                ))}
              </select>
            </div>

            {/* Project Group */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Project Group
              </label>
              <input
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="e.g. WorknAi"
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Tech Stack */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Technology / Framework
              </label>
              <input
                type="text"
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                placeholder="e.g. Next.js 14, Node.js"
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Configured Port & Reverse Proxy */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Port &amp; Reverse Proxy
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="3000"
                  className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
                />
                <select
                  value={reverseProxy}
                  onChange={(e) => setReverseProxy(e.target.value)}
                  className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer border border-outline-variant/30"
                >
                  <option value="Nginx">Nginx</option>
                  <option value="Caddy">Caddy</option>
                  <option value="Apache">Apache</option>
                  <option value="Cloudflare Tunnel">Cloudflare Tunnel</option>
                  <option value="Direct">Direct</option>
                </select>
              </div>
            </div>

            {/* SSL Status */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                SSL Certificate Reference State
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSslStatus('healthy');
                    setSslLabel('Recorded • Valid • 68d');
                  }}
                  className={`h-9 px-unit-sm rounded-lg font-caption-xs text-caption-xs font-medium border transition-colors ${
                    sslStatus === 'healthy'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                      : 'bg-surface-container-low text-secondary border-outline-variant/30'
                  }`}
                >
                  Valid Recorded
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSslStatus('expiring');
                    setSslLabel('Recorded • Expiring • 12d');
                  }}
                  className={`h-9 px-unit-sm rounded-lg font-caption-xs text-caption-xs font-medium border transition-colors ${
                    sslStatus === 'expiring'
                      ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold'
                      : 'bg-surface-container-low text-secondary border-outline-variant/30'
                  }`}
                >
                  Expiring Soon
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSslStatus('warning');
                    setSslLabel('Recorded • Self-Signed');
                  }}
                  className={`h-9 px-unit-sm rounded-lg font-caption-xs text-caption-xs font-medium border transition-colors ${
                    sslStatus === 'warning'
                      ? 'bg-error-container text-on-error-container border-error/30 font-semibold'
                      : 'bg-surface-container-low text-secondary border-outline-variant/30'
                  }`}
                >
                  Self-Signed / Warning
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
              Deployment &amp; Routing Directives
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add deployment notes, responsible owner, or reverse proxy directives..."
              rows={2}
              className="p-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none border border-outline-variant/30"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-unit-sm pt-unit-sm border-t border-surface-container">
            <button
              onClick={onClose}
              className="h-9 px-unit-lg rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors border border-outline-variant/30"
              type="button"
            >
              Cancel
            </button>
            <button
              className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm transition-colors"
              type="submit"
            >
              {editWebsite ? 'Save Changes' : 'Add Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
