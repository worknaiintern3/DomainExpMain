import React, { useMemo, useState } from 'react';
import { formatMinorUnits, type DomainAvailabilityResult, type DomainAvailabilityProvider } from '@/api/domain-search';
import { calculateTransferSavings, priceOf, providerLabel } from '../pricing.calc';

interface TransferSavingsCalculatorProps {
  results: DomainAvailabilityResult[];
  domain: string | null;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/gu, '""')}"`;
}

/** Defaults to the dearest vs cheapest renewal within one shared currency. */
function defaultPair(
  eligible: readonly DomainAvailabilityResult[],
): { current: DomainAvailabilityProvider | null; target: DomainAvailabilityProvider | null } {
  const byCurrency = new Map<string, DomainAvailabilityResult[]>();
  for (const result of eligible) {
    const key = result.currency ?? '';
    byCurrency.set(key, [...(byCurrency.get(key) ?? []), result]);
  }
  for (const group of [...byCurrency.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g)) {
    if (group.length < 2) continue;
    const ordered = [...group].sort(
      (a, b) => (priceOf(b, 'renewal') ?? 0) - (priceOf(a, 'renewal') ?? 0),
    );
    return { current: ordered[0]?.provider ?? null, target: ordered[ordered.length - 1]?.provider ?? null };
  }
  return { current: eligible[0]?.provider ?? null, target: eligible[1]?.provider ?? null };
}

export const TransferSavingsCalculator: React.FC<TransferSavingsCalculatorProps> = ({
  results,
  domain,
}) => {
  const eligible = useMemo(
    () => results.filter((r) => priceOf(r, 'renewal') !== null),
    [results],
  );
  const defaults = useMemo(() => defaultPair(eligible), [eligible]);
  const [currentChoice, setCurrentChoice] = useState<DomainAvailabilityProvider | null>(null);
  const [targetChoice, setTargetChoice] = useState<DomainAvailabilityProvider | null>(null);
  const [domainCount, setDomainCount] = useState<number>(12);
  const [guideModalOpen, setGuideModalOpen] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<boolean>(false);

  const currentProvider = eligible.some((r) => r.provider === currentChoice)
    ? currentChoice
    : defaults.current;
  const targetProvider = eligible.some((r) => r.provider === targetChoice)
    ? targetChoice
    : defaults.target;
  const currentReg = eligible.find((r) => r.provider === currentProvider);
  const targetReg = eligible.find((r) => r.provider === targetProvider);

  const calc = calculateTransferSavings(currentReg, targetReg, domainCount);
  const currency = currentReg?.currency ?? null;
  const fmt = (minor: number | null) => formatMinorUnits(minor, currency) ?? '—';
  const currentRenewal = currentReg ? formatMinorUnits(priceOf(currentReg, 'renewal'), currentReg.currency) : null;
  const targetRenewal = targetReg ? formatMinorUnits(priceOf(targetReg, 'renewal'), targetReg.currency) : null;

  let unavailableReason: string | null = null;
  if (eligible.length < 2) {
    unavailableReason =
      'Needs renewal prices from at least two registrars. Fewer than two returned one for this domain.';
  } else if (calc === null) {
    unavailableReason =
      currentReg && targetReg && currentReg.currency !== targetReg.currency
        ? 'The selected registrars quote in different currencies, and no exchange-rate source is used, so savings cannot be computed.'
        : 'Savings could not be computed for this selection.';
  }

  const handleExportCsv = () => {
    if (!calc || !currentReg || !targetReg) return;
    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 2500);

    const rows: [string, string][] = [
      ['Domain', domain ?? ''],
      ['Currency', currentReg.currency ?? ''],
      ['Current Registrar', providerLabel(currentReg.provider)],
      ['Target Registrar', providerLabel(targetReg.provider)],
      ['Number of Domains', String(domainCount)],
      ['Current Annual Renewal Rate', currentRenewal ?? ''],
      ['Target Annual Renewal Rate', targetRenewal ?? ''],
      ['Current Annual Total', fmt(calc.currentAnnualMinorUnits)],
      ['Projected Annual Total', fmt(calc.projectedAnnualMinorUnits)],
      ['Estimated Annual Savings', fmt(calc.annualSavingsMinorUnits)],
      ['Estimated 3-Year Savings', fmt(calc.threeYearSavingsMinorUnits)],
      ['Estimated Savings Percentage', `${calc.percentSavings}%`],
    ];
    const csvContent =
      'data:text/csv;charset=utf-8,Metric,Value\n' +
      rows.map(([metric, value]) => `${csvCell(metric)},${csvCell(value)}`).join('\n') +
      '\n';

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `domainpulse_renewal_savings_${domainCount}_domains.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-unit-base rounded-lg bg-surface-container-lowest shadow-micro border border-outline-variant/30">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-unit-sm mb-unit-base">
        <div className="flex items-center gap-unit-sm">
          <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">calculate</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Renewal Savings Estimate
            </h3>
            <p className="font-caption-xs text-caption-xs text-secondary">
              Estimate portfolio consolidation savings from the live renewal prices returned above
              {domain ? ` for ${domain}` : ''}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-unit-sm flex-wrap">
          {exportNotice && (
            <span className="text-caption-xs text-emerald-700 font-semibold animate-pulse">
              Exported CSV!
            </span>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={calc === null}
            className="h-8 px-unit-sm rounded bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high flex items-center gap-1 transition-colors cursor-pointer border border-outline-variant/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export Savings Estimate (CSV)</span>
          </button>
          <button
            type="button"
            onClick={() => setGuideModalOpen(true)}
            className="h-8 px-unit-sm rounded bg-surface-container text-primary font-label-md text-label-md hover:bg-surface-container-high flex items-center gap-1 transition-colors cursor-pointer border border-outline-variant/20"
          >
            <span>Step-by-step Guide</span>
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-unit-lg items-center">
        {/* Input Deck (5 cols) */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-unit-sm">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="transfer-current-registrar"
              className="font-caption-xs text-caption-xs text-secondary font-medium"
            >
              Current Registrar
            </label>
            <select
              id="transfer-current-registrar"
              value={currentProvider ?? ''}
              disabled={eligible.length === 0}
              onChange={(event) => setCurrentChoice(event.target.value as DomainAvailabilityProvider)}
              className="h-9 px-unit-sm rounded bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer truncate"
            >
              {eligible.length === 0 && <option value="">No renewal prices</option>}
              {eligible.map((reg) => (
                <option key={reg.provider} value={reg.provider}>
                  {providerLabel(reg.provider)} (
                  {formatMinorUnits(priceOf(reg, 'renewal'), reg.currency)}/yr)
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-caption-xs text-caption-xs text-secondary font-medium">
              Current Renewal Price
            </span>
            <div className="h-9 px-unit-sm rounded bg-surface-container flex items-center font-label-mono text-label-mono text-rose-700 font-bold border border-outline-variant/20">
              {currentRenewal ? `${currentRenewal} /yr` : '—'}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="transfer-target-registrar"
              className="font-caption-xs text-caption-xs text-secondary font-medium"
            >
              Target Registrar
            </label>
            <select
              id="transfer-target-registrar"
              value={targetProvider ?? ''}
              disabled={eligible.length === 0}
              onChange={(event) => setTargetChoice(event.target.value as DomainAvailabilityProvider)}
              className="h-9 px-unit-sm rounded bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/30 cursor-pointer truncate"
            >
              {eligible.length === 0 && <option value="">No renewal prices</option>}
              {eligible.map((reg) => (
                <option key={reg.provider} value={reg.provider}>
                  {providerLabel(reg.provider)} (
                  {formatMinorUnits(priceOf(reg, 'renewal'), reg.currency)}/yr)
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-caption-xs text-caption-xs text-secondary font-medium">
              Target Renewal Price
            </span>
            <div className="h-9 px-unit-sm rounded bg-surface-container flex items-center font-label-mono text-label-mono text-primary font-bold border border-outline-variant/20">
              {targetRenewal ? `${targetRenewal} /yr` : '—'}
            </div>
          </div>

          <div className="col-span-2 flex flex-col gap-1 mt-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="transfer-domain-count"
                className="font-caption-xs text-caption-xs text-secondary font-medium"
              >
                Number of Domains
              </label>
              <span className="font-label-mono text-label-mono font-bold text-primary">
                {domainCount} domains
              </span>
            </div>
            <input
              id="transfer-domain-count"
              type="range"
              min="1"
              max="100"
              value={domainCount}
              onChange={(event) => setDomainCount(Number(event.target.value))}
              className="w-full h-2 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex items-center justify-between text-caption-xs font-caption-xs text-secondary select-none">
              <span>1</span>
              <span>25</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>
        </div>

        {/* Results Output Deck (7 cols) */}
        <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-unit-sm p-unit-base rounded-lg bg-surface-container-low border border-outline-variant/20">
          <div className="flex flex-col">
            <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
              Current Annual
            </span>
            <span className="font-headline-sm text-headline-sm font-label-mono text-rose-700 font-bold mt-1">
              {calc ? fmt(calc.currentAnnualMinorUnits) : '—'}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary">Without transfers</span>
          </div>

          <div className="flex flex-col">
            <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
              Projected Annual
            </span>
            <span className="font-headline-sm text-headline-sm font-label-mono text-primary font-bold mt-1">
              {calc ? fmt(calc.projectedAnnualMinorUnits) : '—'}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary">
              At the target renewal rate
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
              Estimated Annual Savings
            </span>
            <span className="font-headline-sm text-headline-sm font-label-mono text-primary font-bold mt-1">
              {calc ? fmt(calc.annualSavingsMinorUnits) : '—'}
            </span>
            <span className="font-caption-xs text-caption-xs text-emerald-700 font-semibold">
              {calc ? `${calc.percentSavings}% Cost Drop` : ' '}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
              Estimated 3-Year Savings
            </span>
            <span className="font-headline-sm text-headline-sm font-label-mono text-on-surface font-bold mt-1">
              {calc ? fmt(calc.threeYearSavingsMinorUnits) : '—'}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary">Total Net Saved</span>
          </div>
        </div>
      </div>

      {unavailableReason && (
        <p role="note" className="mt-unit-sm font-caption-xs text-caption-xs text-amber-800">
          {unavailableReason}
        </p>
      )}

      <div className="mt-unit-sm pt-unit-xs text-caption-xs font-caption-xs text-secondary border-t border-surface-container/60">
        Note: Estimate from returned renewal prices only; one-time transfer fees are excluded.
        Actual savings may differ due to taxes, promotions, transfer fees and future pricing
        changes.
      </div>

      {/* Guide Modal */}
      {guideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-unit-lg shadow-xl border border-outline-variant/30 flex flex-col gap-unit-md">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Domain Transfer Step-by-Step Guide
              </h3>
              <button
                type="button"
                onClick={() => setGuideModalOpen(false)}
                aria-label="Close guide"
                className="p-1 rounded text-secondary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-unit-sm text-body-sm text-secondary">
              <div className="flex gap-2">
                <span className="font-bold text-primary">1.</span>
                <span><strong>Unlock Domain:</strong> Disable the registrar transfer lock in your current provider portal.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary">2.</span>
                <span><strong>Obtain Auth Code (EPP):</strong> Request your transfer authorization key from the current registrar.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary">3.</span>
                <span><strong>Initiate at Destination:</strong> Enter the domain name and auth code at the target registrar.</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary">4.</span>
                <span><strong>Preserve DNS:</strong> Keep your nameservers pointing at your current DNS provider during the transfer window.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGuideModalOpen(false)}
              className="mt-2 h-9 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-tertiary transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
