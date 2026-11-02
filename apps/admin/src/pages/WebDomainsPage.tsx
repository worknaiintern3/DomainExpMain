import React, { useEffect, useState } from 'react';
import { adminClient } from '../api/admin.client';
import {
  IconExternalLink,
  IconGlobe,
  IconLock,
  IconRefresh,
  IconSearch,
} from '../components/Icons';
import type { WebDomainItem } from '../types/admin.types';

export const WebDomainsPage: React.FC = () => {
  const [domains, setDomains] = useState<WebDomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const data = await adminClient.getAllDomains(search);
      setDomains(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, [search]);

  const filtered = domains.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Website Monitored Domains
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
              {filtered.length} Domains
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Global repository of all domain names, SSL certificates, and DNS records monitored across all website users.
          </p>
        </div>

        <button
          onClick={fetchDomains}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm"
        >
          <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh DNS Status</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <IconSearch
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search domains or owner email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="all">All Domains</option>
            <option value="active">Active & Healthy</option>
            <option value="expiring">Expiring Soon (&lt; 30d)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Scanning WHOIS & TLS certificates...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">No domains match your search query.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-6">Domain Name</th>
                  <th className="py-3.5 px-4">Owner Account</th>
                  <th className="py-3.5 px-4">Registrar</th>
                  <th className="py-3.5 px-4">SSL Certificate</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Expiry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {filtered.map((dom) => (
                  <tr key={dom.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-6 font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                      <IconGlobe size={16} />
                      <span>{dom.domainName}</span>
                      <a
                        href={`https://${dom.domainName}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-blue-500 ml-1"
                      >
                        <IconExternalLink size={12} />
                      </a>
                    </td>

                    <td className="py-4 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {dom.ownerEmail || 'Unknown'}
                    </td>

                    <td className="py-4 px-4">{dom.registrarName}</td>

                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          dom.sslStatus === 'valid'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                        }`}
                      >
                        <IconLock size={12} />
                        {dom.sslStatus === 'valid' ? 'Valid SSL (TLS 1.3)' : 'Expiring Soon'}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          dom.status === 'active'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                        }`}
                      >
                        {dom.status}
                      </span>
                    </td>

                    <td className="py-4 px-4 font-mono text-[11px]">
                      {dom.expiresAt ? new Date(dom.expiresAt).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
