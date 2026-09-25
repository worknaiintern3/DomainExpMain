import React, { useEffect, useState } from 'react';
import type { MobileAuditLogResponse } from '@domainpulse/contracts';
import { mobileAdminClient } from '../api/mobile-admin.client';

export const MobileAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<MobileAuditLogResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    mobileAdminClient
      .getAuditLogs()
      .then(setLogs)
      .catch(() => {
        setLogs([]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Mobile Admin Audit Trail</h2>
        <p className="text-sm text-slate-400 mt-1">
          Cryptographically immutable server-side record of all mobile remote configuration updates.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Recorded Events ({logs.length})
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading audit entries...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No audit records found yet. Actions taken in this admin console will automatically appear here.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {log.action}
                    </span>
                    <span className="font-semibold text-slate-300">{log.target}</span>
                  </div>
                  <span className="text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
                {log.details && (
                  <pre className="mt-2 p-2.5 bg-slate-950 rounded-lg text-[11px] font-mono text-slate-400 overflow-x-auto border border-slate-800">
                    {log.details}
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
