import React, { useState } from 'react';
import { HOSTING_PROVIDERS_PRICING } from '../pricing.reference';
import { HostingCategory } from '../pricing.types';

export const HostingPricingMatrix: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<HostingCategory>('all');
  const [selectedGeo, setSelectedGeo] = useState<string>('all');

  const filteredHosting = HOSTING_PROVIDERS_PRICING.filter((h) => {
    if (selectedCategory !== 'all' && h.category !== selectedCategory) return false;
    if (selectedGeo !== 'all' && !h.regions.includes(selectedGeo)) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-unit-md">
      {/* Category Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-unit-sm p-unit-base rounded-lg bg-surface-container-lowest shadow-micro border border-outline-variant/30">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All Hosting' },
              { id: 'shared', label: 'Shared' },
              { id: 'wordpress', label: 'WordPress' },
              { id: 'vps', label: 'VPS' },
              { id: 'cloud', label: 'Cloud' },
              { id: 'serverless', label: 'Serverless' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-unit-md py-1 rounded-full text-label-md font-label-md transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-primary text-on-primary font-semibold shadow-xs'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-unit-sm">
          <span className="font-caption-xs text-caption-xs text-secondary">Server Geo:</span>
          <select
            value={selectedGeo}
            onChange={(e) => setSelectedGeo(e.target.value)}
            className="h-8 px-unit-sm rounded bg-surface-container text-on-surface font-body-sm text-body-sm focus:outline-none border border-outline-variant/30 cursor-pointer"
          >
            <option value="all">All Locations (India, Singapore, US, EU)</option>
            <option value="India">India Only (Mumbai / Bangalore / Delhi)</option>
            <option value="Singapore">Singapore (APAC Low Latency)</option>
            <option value="US">US &amp; Europe</option>
          </select>
        </div>
      </div>

      {/* Hosting Providers Benchmark Matrix Table */}
      <div className="rounded-lg bg-surface-container-lowest shadow-micro border border-outline-variant/30 overflow-hidden">
        <div className="px-unit-base py-unit-sm bg-surface-container-low flex items-center justify-between border-b border-surface-container/50">
          <div className="flex items-center gap-unit-sm">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Hosting Benchmark &amp; Infrastructure Matrix
            </h3>
            <span className="px-2 py-0.5 rounded bg-surface-container font-label-mono text-caption-xs text-on-surface-variant font-medium">
              India &amp; Global Datacenters
            </span>
          </div>
          <span className="font-caption-xs text-caption-xs text-secondary">
            Normalized monthly &amp; annual tiers (Reference Dataset)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="h-8 bg-surface-container-low text-secondary font-caption-xs text-caption-xs uppercase tracking-wider select-none border-b border-surface-container/50">
                <th className="px-unit-md py-1 font-semibold">Provider &amp; Tier</th>
                <th className="px-unit-sm py-1 font-semibold">Monthly Effective</th>
                <th className="px-unit-sm py-1 font-semibold">Annual Billed</th>
                <th className="px-unit-sm py-1 font-semibold">Storage / Bandwidth</th>
                <th className="px-unit-sm py-1 font-semibold">SSL &amp; Domain</th>
                <th className="px-unit-sm py-1 font-semibold">Datacenter Locations</th>
                <th className="px-unit-sm py-1 font-semibold">Refund Policy</th>
                <th className="px-unit-md py-1 font-semibold text-right">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-body-sm font-body-sm">
              {filteredHosting.map((h) => (
                <tr
                  key={h.id}
                  className={`h-12 transition-colors ${
                    h.renewalHikeWarning
                      ? 'bg-rose-50/30 hover:bg-rose-50/60'
                      : 'hover:bg-surface-container-low/60 bg-surface-container-lowest'
                  }`}
                >
                  {/* 1. Provider & Tier */}
                  <td className="px-unit-md py-2 flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px] text-primary">
                        {h.icon}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-md text-label-md text-on-surface font-semibold">
                        {h.providerName}
                      </span>
                      <span className="font-caption-xs text-[11px] text-secondary truncate">
                        {h.tierName}
                      </span>
                    </div>
                  </td>

                  {/* 2. Monthly Effective */}
                  <td
                    className={`px-unit-sm py-2 font-label-mono text-label-mono font-semibold ${
                      h.verdictVariant === 'primary' || h.verdictVariant === 'best'
                        ? 'text-primary'
                        : h.renewalHikeWarning
                        ? 'text-rose-700'
                        : 'text-on-surface'
                    }`}
                  >
                    {h.monthlyFormatted}
                  </td>

                  {/* 3. Annual Billed */}
                  <td className="px-unit-sm py-2 font-label-mono text-label-mono text-on-surface">
                    {h.annualFormatted}
                  </td>

                  {/* 4. Storage / Bandwidth */}
                  <td className="px-unit-sm py-2">
                    <span className="font-label-mono text-caption-xs text-on-surface font-medium block">
                      {h.storage}
                    </span>
                    <span className="text-caption-xs text-secondary block">{h.bandwidth}</span>
                  </td>

                  {/* 5. SSL & Domain */}
                  <td className="px-unit-sm py-2">
                    <span
                      className={`text-caption-xs font-medium ${
                        h.renewalHikeWarning ? 'text-rose-700' : 'text-on-surface'
                      }`}
                    >
                      {h.sslAndDomain}
                    </span>
                  </td>

                  {/* 6. Datacenter Locations */}
                  <td className="px-unit-sm py-2 text-caption-xs text-on-surface">
                    {h.datacenters}
                  </td>

                  {/* 7. Refund Policy */}
                  <td className="px-unit-sm py-2 text-caption-xs text-secondary">
                    {h.refundPolicy}
                  </td>

                  {/* 8. Verdict */}
                  <td className="px-unit-md py-2 text-right">
                    <span
                      className={`px-2 py-0.5 rounded font-caption-xs text-caption-xs font-semibold ${
                        h.verdictVariant === 'best'
                          ? 'bg-secondary-container text-on-secondary-container'
                          : h.verdictVariant === 'primary'
                          ? 'bg-primary text-on-primary'
                          : h.verdictVariant === 'warning'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {h.verdict}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
