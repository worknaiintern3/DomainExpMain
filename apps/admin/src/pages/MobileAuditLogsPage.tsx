import React, { useEffect, useState } from 'react';
import type { MobileAuditLogResponse } from '@domainpulse/contracts';
import { adminClient } from '../api/admin.client';
import { IconHistory, IconRefresh } from '../components/Icons';

export const MobileAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<MobileAuditLogResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLogs = () => {
    setIsLoading(true);
    adminClient
      .getAuditLogs()
      .then(setLogs)
      .catch(() => {
        setLogs([]);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <IconHistory size={24} className="text-blue-500" />
            Platform & Mobile Admin Audit Trail
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Immutable server-side record of all website and mobile remote configuration updates.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-sm"
        >
          <IconRefresh size={13} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Recorded Audit Events ({logs.length})
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading audit log entries...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            No audit records found yet. Actions taken in this console will automatically appear here.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-500/30 text-[11px]">
                      {log.action}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                      {log.target}
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px] font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                {log.details && (
                  <pre className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl text-[11px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto border border-slate-200 dark:border-slate-800">
                    {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
