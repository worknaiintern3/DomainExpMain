import React, { useState } from 'react';
import type { NormalizedWhoisData } from '@/api/whois.types';
import { Button } from '@/components/common/Button';

interface WhoisDetailsModalProps {
  data: NormalizedWhoisData | null;
  loading?: boolean;
  error?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onAddToPortfolio?: (domainName: string, expiresAt?: string | null) => void;
}

export const WhoisDetailsModal: React.FC<WhoisDetailsModalProps> = ({
  data,
  loading = false,
  error = null,
  isOpen,
  onClose,
  onRefresh,
  onAddToPortfolio,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'registrar' | 'nameservers' | 'raw' | 'json'>('summary');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Not recorded';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(undefined, { dateStyle: 'long' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-surface-container-lowest border border-outline-variant/60 rounded-2xl shadow-modal overflow-hidden flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-unit-lg border-b border-outline-variant/30 bg-surface-container-low/40">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-unit-sm flex-wrap">
              <span className="material-symbols-outlined text-[24px] text-primary">verified_user</span>
              <h2 className="font-label-mono text-headline-md font-bold text-on-surface truncate">
                {data?.domainName || 'WHOIS Record'}
              </h2>
              {data && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-caption-xs font-semibold ${
                    data.isRegistered
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300/50'
                      : 'bg-primary/10 text-primary border border-primary/25'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      data.isRegistered ? 'bg-emerald-500 animate-pulse' : 'bg-primary'
                    }`}
                  />
                  {data.isRegistered ? 'Registered' : 'Available for Registration'}
                </span>
              )}
              {data?.savedToDatabase && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container text-secondary text-[11px] font-mono border border-outline-variant/40">
                  <span className="material-symbols-outlined text-[12px] text-primary">database</span>
                  Saved to DB
                </span>
              )}
            </div>
            <p className="text-caption-xs text-secondary flex items-center gap-2">
              <span>Live WHOIS retrieved via WhoisFreaks</span>
              {data?.retrievedAt && (
                <>
                  <span>•</span>
                  <span>{new Date(data.retrievedAt).toLocaleTimeString()}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface transition-colors"
                title="Refresh from WhoisFreaks"
              >
                <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>
                  refresh
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 gap-3">
            <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="font-body-sm text-secondary">Querying WhoisFreaks live database...</p>
          </div>
        ) : error ? (
          <div className="p-unit-xl flex flex-col items-center justify-center text-center gap-2">
            <span className="material-symbols-outlined text-error text-[36px]">error</span>
            <p className="font-headline-sm font-semibold text-error">WHOIS Lookup Failed</p>
            <p className="text-body-sm text-secondary max-w-md">{error}</p>
            {onRefresh && (
              <Button size="sm" variant="secondary" onClick={onRefresh} className="mt-2">
                Retry Lookup
              </Button>
            )}
          </div>
        ) : !data ? (
          <div className="p-unit-xl text-center text-secondary">No domain details available.</div>
        ) : (
          <>
            {/* Quick Metrics Bento Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-outline-variant/25 bg-surface-container-low/20">
              <div className="p-unit-sm border-r border-outline-variant/20 flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Registrar</span>
                <span className="text-label-md font-semibold text-on-surface truncate mt-0.5" title={data.registrar.name || 'Unknown'}>
                  {data.registrar.name || 'Not reported'}
                </span>
              </div>
              <div className="p-unit-sm border-r border-outline-variant/20 flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Created Date</span>
                <span className="text-label-md font-semibold text-on-surface mt-0.5">
                  {formatDate(data.registeredAt)}
                </span>
              </div>
              <div className="p-unit-sm border-r border-outline-variant/20 flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Expiry Date</span>
                <span className={`text-label-md font-semibold mt-0.5 ${data.daysRemaining !== null && data.daysRemaining <= 30 ? 'text-error' : 'text-on-surface'}`}>
                  {formatDate(data.expiresAt)}
                </span>
              </div>
              <div className="p-unit-sm flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Days Left</span>
                <span className={`text-label-md font-bold font-mono mt-0.5 ${data.daysRemaining !== null && data.daysRemaining <= 30 ? 'text-error' : 'text-primary'}`}>
                  {data.daysRemaining !== null ? `${data.daysRemaining} days` : '—'}
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 px-unit-md border-b border-outline-variant/30 bg-surface-container-lowest overflow-x-auto">
              {[
                { id: 'summary', label: 'Summary', icon: 'dashboard' },
                { id: 'registrar', label: 'Registrar & Contacts', icon: 'badge' },
                { id: 'nameservers', label: `Nameservers (${data.nameservers.length})`, icon: 'dns' },
                { id: 'raw', label: 'Raw WHOIS', icon: 'terminal' },
                { id: 'json', label: 'Full JSON', icon: 'code' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-unit-md py-2.5 text-caption-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-secondary hover:text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Views */}
            <div className="p-unit-md overflow-y-auto max-h-[50vh] flex-1 flex flex-col gap-unit-md">
              {/* 1. Summary Tab */}
              {activeTab === 'summary' && (
                <div className="flex flex-col gap-unit-md">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-sm">
                    <div className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Domain Name</p>
                      <p className="text-body-md font-mono font-bold text-on-surface mt-1">{data.domainName}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Registry Query Time</p>
                      <p className="text-body-sm font-mono text-on-surface mt-1">{data.queryTime || 'Just now'}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Registration Lifecycle</p>
                      <p className="text-body-sm text-on-surface mt-1">
                        Registered on {formatDate(data.registeredAt)} • Updated on {formatDate(data.updatedDate)}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">Expiration Status</p>
                      <p className="text-body-sm font-semibold text-on-surface mt-1">
                        {data.daysRemaining !== null
                          ? data.daysRemaining < 0
                            ? `Expired ${Math.abs(data.daysRemaining)} days ago`
                            : `Expires in ${data.daysRemaining} days (${formatDate(data.expiresAt)})`
                          : 'Not reported'}
                      </p>
                    </div>
                  </div>

                  {/* Status Flags */}
                  {data.statuses.length > 0 && (
                    <div className="p-unit-md rounded-xl border border-outline-variant/30 bg-surface-container-low">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary mb-2">
                        ICANN / EPP Status Flags ({data.statuses.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {data.statuses.map((st, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md bg-surface-container font-mono text-[11px] text-on-surface border border-outline-variant/30"
                          >
                            {st}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Authoritative Nameservers Preview */}
                  {data.nameservers.length > 0 && (
                    <div className="p-unit-md rounded-xl border border-outline-variant/30 bg-surface-container-low">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
                          Nameservers ({data.nameservers.length})
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCopy(data.nameservers.join('\n'), 'all_ns')}
                          className="text-[11px] font-semibold text-primary hover:underline"
                        >
                          {copiedKey === 'all_ns' ? 'Copied all!' : 'Copy all'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {data.nameservers.map((ns, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/20 font-mono text-caption-xs"
                          >
                            <span className="truncate">{ns}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(ns, `ns_${idx}`)}
                              className="text-secondary hover:text-primary ml-2"
                              title="Copy nameserver"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {copiedKey === `ns_${idx}` ? 'check' : 'content_copy'}
                              </span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Registrar & Contacts Tab */}
              {activeTab === 'registrar' && (
                <div className="flex flex-col gap-unit-md">
                  {/* Registrar Card */}
                  <div className="p-unit-md rounded-xl border border-outline-variant/30 bg-surface-container-low flex flex-col gap-2">
                    <p className="text-label-md font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-[18px]">business</span>
                      Sponsoring Registrar
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-unit-sm text-caption-xs pt-1">
                      <div>
                        <span className="text-secondary">Name:</span>
                        <p className="font-semibold text-on-surface">{data.registrar.name || 'Not reported'}</p>
                      </div>
                      <div>
                        <span className="text-secondary">IANA ID:</span>
                        <p className="font-mono font-semibold text-on-surface">{data.registrar.ianaId || 'Not reported'}</p>
                      </div>
                      <div>
                        <span className="text-secondary">Website:</span>
                        <p className="font-mono text-primary truncate">
                          {data.registrar.websiteUrl ? (
                            <a href={data.registrar.websiteUrl} target="_blank" rel="noreferrer" className="hover:underline">
                              {data.registrar.websiteUrl}
                            </a>
                          ) : (
                            'Not reported'
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-secondary">Abuse Email:</span>
                        <p className="font-mono text-on-surface">{data.registrar.email || 'Not reported'}</p>
                      </div>
                      <div>
                        <span className="text-secondary">Abuse Phone:</span>
                        <p className="font-mono text-on-surface">{data.registrar.phone || 'Not reported'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Registrant Contact */}
                  <div className="p-unit-md rounded-xl border border-outline-variant/30 bg-surface-container-low flex flex-col gap-2">
                    <p className="text-label-md font-semibold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                      Registrant Contact
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-unit-sm text-caption-xs pt-1">
                      <div>
                        <span className="text-secondary">Organization:</span>
                        <p className="font-semibold text-on-surface">{data.registrant?.company || data.registrant?.name || 'Withheld / Redacted for Privacy'}</p>
                      </div>
                      <div>
                        <span className="text-secondary">Country:</span>
                        <p className="font-semibold text-on-surface">{data.registrant?.country_name || data.registrant?.country_code || 'Not reported'}</p>
                      </div>
                      <div>
                        <span className="text-secondary">Email:</span>
                        <p className="font-mono text-on-surface truncate">{data.registrant?.email_address || 'Privacy Protected'}</p>
                      </div>
                      <div>
                        <span className="text-secondary">City / State:</span>
                        <p className="text-on-surface">{[data.registrant?.city, data.registrant?.state].filter(Boolean).join(', ') || 'Not reported'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Technical Contact */}
                  {data.technicalContact && (
                    <div className="p-unit-md rounded-xl border border-outline-variant/30 bg-surface-container-low flex flex-col gap-2">
                      <p className="text-label-md font-semibold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-[18px]">engineering</span>
                        Technical Contact
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-unit-sm text-caption-xs pt-1">
                        <div>
                          <span className="text-secondary">Email:</span>
                          <p className="font-mono text-on-surface truncate">{data.technicalContact.email_address || 'Not reported'}</p>
                        </div>
                        <div>
                          <span className="text-secondary">Organization:</span>
                          <p className="text-on-surface">{data.technicalContact.company || 'Not reported'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Nameservers Tab */}
              {activeTab === 'nameservers' && (
                <div className="flex flex-col gap-unit-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-caption-xs text-secondary">Authoritative nameservers for {data.domainName}:</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(data.nameservers.join('\n'), 'all_ns')}
                    >
                      {copiedKey === 'all_ns' ? 'Copied all!' : 'Copy list'}
                    </Button>
                  </div>
                  {data.nameservers.length === 0 ? (
                    <p className="text-body-sm text-secondary">No nameservers reported for this domain.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {data.nameservers.map((ns, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low font-mono text-body-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-[18px] text-primary">dns</span>
                            <span className="font-bold text-on-surface truncate">{ns}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(ns, `ns_tab_${idx}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-highest text-caption-xs font-semibold text-secondary hover:text-on-surface transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {copiedKey === `ns_tab_${idx}` ? 'check' : 'content_copy'}
                            </span>
                            <span>{copiedKey === `ns_tab_${idx}` ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 4. Raw WHOIS Tab */}
              {activeTab === 'raw' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-caption-xs text-secondary">Raw text returned by the WHOIS registry server:</p>
                    {data.rawWhois && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCopy(data.rawWhois || '', 'raw_whois')}
                      >
                        {copiedKey === 'raw_whois' ? 'Copied text!' : 'Copy raw text'}
                      </Button>
                    )}
                  </div>
                  <pre className="p-unit-md rounded-xl bg-slate-950 text-slate-200 font-mono text-caption-xs leading-relaxed overflow-x-auto max-h-96 whitespace-pre-wrap select-all border border-slate-800">
                    {data.rawWhois || 'No raw WHOIS text provided.'}
                  </pre>
                </div>
              )}

              {/* 5. Full JSON Tab */}
              {activeTab === 'json' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-caption-xs text-secondary">Complete normalized database payload (JSON):</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleCopy(JSON.stringify(data, null, 2), 'raw_json')}
                    >
                      {copiedKey === 'raw_json' ? 'Copied JSON!' : 'Copy JSON'}
                    </Button>
                  </div>
                  <pre className="p-unit-md rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-96 whitespace-pre-wrap select-all border border-slate-800">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer Action Bar */}
            <div className="flex items-center justify-between p-unit-md border-t border-outline-variant/30 bg-surface-container-low/40">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    handleCopy(
                      `Domain: ${data.domainName}\nRegistrar: ${data.registrar.name}\nExpires: ${data.expiresAt}\nCreated: ${data.registeredAt}\nNameservers: ${data.nameservers.join(', ')}`,
                      'summary_copy',
                    )
                  }
                >
                  <span className="material-symbols-outlined text-[16px] mr-1">content_copy</span>
                  {copiedKey === 'summary_copy' ? 'Copied summary!' : 'Copy summary'}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {onAddToPortfolio && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onAddToPortfolio(data.domainName, data.expiresAt)}
                  >
                    <span className="material-symbols-outlined text-[16px] mr-1">add_circle</span>
                    Add to Portfolio
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
