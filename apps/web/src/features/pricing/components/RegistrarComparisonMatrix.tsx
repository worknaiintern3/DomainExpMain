import React from 'react';
import { RegistrarPricing } from '../pricing.types';

interface RegistrarComparisonMatrixProps {
  registrars: RegistrarPricing[];
  selectedRegistrarId: string;
  onSelectRegistrar: (id: string) => void;
  selectedTld: string;
}

export const RegistrarComparisonMatrix: React.FC<RegistrarComparisonMatrixProps> = ({
  registrars,
  selectedRegistrarId,
  onSelectRegistrar,
  selectedTld,
}) => {
  return (
    <div className="rounded-lg bg-surface-container-lowest shadow-micro border border-outline-variant/30 overflow-hidden">
      {/* Table Header Strip */}
      <div className="px-unit-base py-unit-sm bg-surface-container-low flex flex-wrap items-center justify-between gap-unit-xs border-b border-surface-container/50">
        <div className="flex items-center gap-unit-sm">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Registrar Benchmark Matrix
          </h3>
          <span className="px-2 py-0.5 rounded bg-surface-container font-label-mono text-caption-xs text-on-surface-variant font-medium">
            {selectedTld} Top-Level Domain
          </span>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary">
          Click row to view provider details
        </span>
      </div>

      {/* 8-Column Dense Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-8 bg-surface-container-low text-secondary font-caption-xs text-caption-xs uppercase tracking-wider select-none border-b border-surface-container/50">
              <th className="px-unit-md py-1 font-semibold">Registrar</th>
              <th className="px-unit-sm py-1 font-semibold">Registration</th>
              <th className="px-unit-sm py-1 font-semibold">Renewal</th>
              <th className="px-unit-sm py-1 font-semibold">Transfer</th>
              <th className="px-unit-sm py-1 font-semibold">Hike %</th>
              <th className="px-unit-sm py-1 font-semibold">WHOIS Privacy</th>
              <th className="px-unit-sm py-1 font-semibold">DNSSEC</th>
              <th className="px-unit-sm py-1 font-semibold">Score</th>
              <th className="px-unit-md py-1 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container text-body-sm font-body-sm">
            {registrars.map((reg) => {
              const isSelected = reg.id === selectedRegistrarId;

              return (
                <tr
                  key={reg.id}
                  onClick={() => onSelectRegistrar(reg.id)}
                  className={`h-11 cursor-pointer transition-colors group ${
                    isSelected
                      ? 'bg-primary/5 hover:bg-primary/10'
                      : reg.hikeIsWarning && reg.id === 'godaddy'
                      ? 'bg-rose-50/40 hover:bg-rose-50/70'
                      : 'hover:bg-surface-container-low/60 bg-surface-container-lowest'
                  }`}
                >
                  {/* 1. Registrar */}
                  <td className="px-unit-md py-1.5 flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-primary-container text-on-primary'
                          : reg.id === 'godaddy'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-surface-container text-primary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {reg.icon}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span
                        className={`font-label-md text-label-md font-semibold truncate transition-colors ${
                          isSelected
                            ? 'text-primary'
                            : reg.id === 'godaddy'
                            ? 'text-rose-900 group-hover:text-primary'
                            : 'text-on-surface group-hover:text-primary'
                        }`}
                      >
                        {reg.registrarName}
                      </span>
                      {reg.icannId && (
                        <span className="font-caption-xs text-[10px] text-secondary truncate">
                          {reg.icannId}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 2. Registration */}
                  <td className="px-unit-sm py-1.5 font-label-mono text-label-mono text-on-surface">
                    {reg.registrationFormatted}
                  </td>

                  {/* 3. Renewal */}
                  <td
                    className={`px-unit-sm py-1.5 font-label-mono text-label-mono font-semibold ${
                      reg.hikeIsWarning ? 'text-rose-700' : 'text-primary'
                    }`}
                  >
                    {reg.renewalFormatted}
                  </td>

                  {/* 4. Transfer */}
                  <td
                    className={`px-unit-sm py-1.5 font-label-mono text-label-mono ${
                      reg.topTag === 'Lowest Transfer'
                        ? 'font-bold text-primary'
                        : 'text-on-surface'
                    }`}
                  >
                    {reg.transferFormatted}
                  </td>

                  {/* 5. Hike % */}
                  <td className="px-unit-sm py-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-caption-xs text-[11px] font-medium ${
                        reg.hikePercent === 0
                          ? 'bg-secondary-container text-on-secondary-container font-semibold'
                          : reg.hikeIsWarning
                          ? 'bg-rose-100 text-rose-800 font-bold'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {reg.hikeLabel}
                    </span>
                  </td>

                  {/* 6. WHOIS Privacy */}
                  <td className="px-unit-sm py-1.5">
                    <span
                      className={`font-medium text-caption-xs ${
                        reg.privacyIncluded
                          ? 'text-on-surface'
                          : 'text-rose-700 font-semibold'
                      }`}
                    >
                      {reg.privacyLabel}
                    </span>
                  </td>

                  {/* 7. DNSSEC */}
                  <td className="px-unit-sm py-1.5">
                    {reg.dnssecSupported ? (
                      <span className="material-symbols-outlined text-primary text-[16px]">
                        check_circle
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-outline text-[16px]">
                        cancel
                      </span>
                    )}
                  </td>

                  {/* 8. Score */}
                  <td className="px-unit-sm py-1.5">
                    <span
                      className={`font-label-mono text-label-mono font-bold ${
                        reg.score >= 9.0
                          ? 'text-primary'
                          : reg.score < 7.0
                          ? 'text-rose-700'
                          : 'text-on-surface'
                      }`}
                    >
                      {reg.score.toFixed(1)}
                    </span>
                    <span className="text-caption-xs text-secondary">/10</span>
                  </td>

                  {/* 9. Actions */}
                  <td className="px-unit-md py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {reg.topTag && (
                        <span
                          className={`px-1.5 py-0.5 rounded font-caption-xs text-[10px] font-semibold ${
                            reg.topTag === 'Lowest Transfer'
                              ? 'bg-primary text-on-primary'
                              : reg.topTag === 'Markup Risk'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {reg.topTag}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRegistrar(reg.id);
                        }}
                        className="p-1 rounded text-secondary hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                        title="Inspect Provider"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {isSelected ? 'arrow_forward' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
