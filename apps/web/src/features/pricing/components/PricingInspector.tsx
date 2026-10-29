import React from 'react';
import { formatMinorUnits, type DomainAvailabilityResult } from '@/api/domain-search';
import { priceOf, providerLabel, totalCost } from '../pricing.calc';
import { PROVIDER_ICONS, describeBasis, describeProviderReason, describeStatus, formatFetchedAt } from '../pricing.present';

interface PricingInspectorProps {
  result: DomainAvailabilityResult | undefined;
}

const BASIS_TEXT: Record<DomainAvailabilityResult['pricingNature'], string> = {
  CURRENT: "Returned by the registrar's official pricing API for this request.",
  INDICATIVE:
    'GoDaddy documents availability pricing as indicative. Only a quote locks the price.',
  UNKNOWN: 'No price was returned, so no claim is made.',
};

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col text-center">
      <span className="font-caption-xs text-caption-xs text-secondary">{label}</span>
      <span
        className={`font-label-mono text-label-mono font-bold mt-0.5 ${
          value === null ? 'text-outline' : 'text-on-surface'
        }`}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-body-sm font-body-sm py-0.5 border-b border-surface-container/50 last:border-b-0">
      <div className="flex items-center gap-1.5 text-on-surface-variant">
        <span className="material-symbols-outlined text-[16px] text-primary">{icon}</span>
        <span className="text-caption-xs">{label}</span>
      </div>
      <span className="text-caption-xs text-on-surface font-medium truncate max-w-[180px]">
        {value}
      </span>
    </div>
  );
}

export const PricingInspector: React.FC<PricingInspectorProps> = ({ result }) => {
  if (!result) {
    return (
      <div className="p-unit-base rounded-lg bg-surface-container-lowest shadow-micro border border-outline-variant/30 text-body-sm text-secondary">
        <p className="font-caption-xs text-caption-xs text-secondary mb-1">
          Availability estimate: select a domain and registrar to inspect live rates.
        </p>
        Select a registrar row to see the details it returned.
      </div>
    );
  }

  const status = describeStatus(result);
  const basis = describeBasis(result.pricingNature);
  const threeYear = formatMinorUnits(totalCost(result, 3), result.currency);
  const fiveYear = formatMinorUnits(totalCost(result, 5), result.currency);
  const reasonCopy = describeProviderReason(result.reason);

  return (
    <div className="p-unit-base rounded-lg bg-surface-container-lowest shadow-micro flex flex-col gap-unit-md border border-outline-variant/30">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-unit-sm">
          <div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">
              {PROVIDER_ICONS[result.provider]}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
              {providerLabel(result.provider)}
            </h3>
            <p className="font-caption-xs text-caption-xs text-secondary truncate">
              {result.domain}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full border text-caption-xs font-semibold shrink-0 ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      {status.detail && (
        <p className="font-caption-xs text-caption-xs text-secondary rounded-lg bg-surface-container-low p-unit-sm border border-outline-variant/20">
          {status.detail}
        </p>
      )}

      {/* Pricing Information 3-pack */}
      <div className="flex flex-col gap-unit-xs">
        <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
          Pricing Information{result.currency ? ` (${result.currency})` : ''}
        </span>
        <div className="grid grid-cols-3 gap-unit-xs p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
          <Field
            label="Register (Yr 1)"
            value={
              result.state === 'UNAVAILABLE'
                ? null
                : formatMinorUnits(priceOf(result, 'registration'), result.currency)
            }
          />
          <Field
            label="Renewal/Yr"
            value={formatMinorUnits(priceOf(result, 'renewal'), result.currency)}
          />
          <Field
            label="Transfer"
            value={formatMinorUnits(priceOf(result, 'transfer'), result.currency)}
          />
        </div>

        {/* Projected totals: only when both prices were returned */}
        <div className="flex items-center justify-between px-unit-sm py-unit-xs rounded bg-surface-container text-body-sm font-body-sm">
          <span className="text-secondary text-caption-xs">3-Year Projected Total:</span>
          <span className="font-label-mono text-label-mono font-semibold text-on-surface">
            {threeYear ?? '—'}
          </span>
        </div>
        <div className="flex items-center justify-between px-unit-sm py-unit-xs rounded bg-surface-container text-body-sm font-body-sm">
          <span className="text-secondary text-caption-xs">5-Year Projected Total:</span>
          <span className="font-label-mono text-label-mono font-semibold text-primary">
            {fiveYear ?? '—'}
          </span>
        </div>
        <p className="font-caption-xs text-[10px] text-secondary">
          Totals assume the returned renewal price stays unchanged.
        </p>
      </div>

      {/* Price basis + provider details */}
      <div className="flex flex-col gap-unit-xs">
        <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-medium">
          Price Basis &amp; Provider Details
        </span>
        <div
          className={`p-unit-sm rounded-lg border text-caption-xs ${
            basis ? basis.className : 'bg-surface-container-low text-secondary border-outline-variant/20'
          }`}
        >
          <strong>{basis ? basis.label : 'No price'}:</strong> {BASIS_TEXT[result.pricingNature]}
        </div>
        <Row icon="schedule" label="Fetched" value={formatFetchedAt(result.fetchedAt)} />
        <Row icon="verified" label="Definitive answer" value={result.definitive ? 'Yes' : 'No'} />
        {result.tier && <Row icon="workspace_premium" label="Tier" value={result.tier} />}
        {result.premium && <Row icon="star" label="Premium name" value="Yes" />}
        {reasonCopy && <Row icon="info" label="Reason" value={reasonCopy} />}
        {result.errorCode && <Row icon="error" label="Error code" value={result.errorCode} />}
      </div>

      <p className="font-caption-xs text-[10px] text-secondary text-center">
        DomainPulse does not sell domains. Confirm the final price at the registrar.
      </p>
    </div>
  );
};
