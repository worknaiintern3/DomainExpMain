import React from 'react';

export const ServerMonitoringBanner: React.FC = () => {
  return (
    <div className="p-unit-md rounded-xl bg-amber-50 text-amber-900 border border-amber-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-unit-md mb-unit-lg">
      <div className="flex items-start gap-unit-md">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 border border-amber-300/60">
          <span className="material-symbols-outlined text-[20px]">sensors_off</span>
        </div>
        <div className="flex flex-col gap-unit-2xs">
          <div className="flex items-center gap-unit-sm">
            <span className="font-label-md text-label-md font-semibold text-amber-900">
              Server Monitoring
            </span>
            <span className="inline-flex items-center px-unit-sm py-[2px] rounded-full bg-amber-200/70 text-amber-900 font-caption-xs text-caption-xs font-medium border border-amber-300">
              Not Connected
            </span>
          </div>
          <span className="font-body-sm text-body-sm text-amber-800 leading-relaxed">
            Live CPU, memory, disk and uptime monitoring is not connected. This page currently displays stored server inventory and mapped infrastructure data.
          </span>
        </div>
      </div>
    </div>
  );
};
