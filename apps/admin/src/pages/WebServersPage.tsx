import React, { useEffect, useState } from 'react';
import { adminClient } from '../api/admin.client';
import {
  IconRefresh,
  IconSearch,
  IconServer,
} from '../components/Icons';
import type { WebServerItem } from '../types/admin.types';

export const WebServersPage: React.FC = () => {
  const [servers, setServers] = useState<WebServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchServers = async () => {
    setLoading(true);
    try {
      const data = await adminClient.getAllServers(search);
      setServers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Infrastructure & Monitored Servers
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30">
              {servers.length} Nodes
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time ping monitor, IP reachability, and server node availability across all registered user accounts.
          </p>
        </div>

        <button
          onClick={fetchServers}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm"
        >
          <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
          <span>Ping All Nodes</span>
        </button>
      </div>

      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <IconSearch
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search servers by name, IP, or owner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Pinging server clusters...</span>
          </div>
        ) : servers.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">No server nodes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-6">Server Node</th>
                  <th className="py-3.5 px-4">Host IP / FQDN</th>
                  <th className="py-3.5 px-4">Owner Account</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Uptime SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                {servers.map((srv) => (
                  <tr key={srv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <IconServer size={16} className="text-cyan-500" />
                      <span>{srv.name}</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {srv.host}
                    </td>
                    <td className="py-4 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {srv.ownerEmail || 'Unknown'}
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Operational
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{srv.uptimePercent}%</span>
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
