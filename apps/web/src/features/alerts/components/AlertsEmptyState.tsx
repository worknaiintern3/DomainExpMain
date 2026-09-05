import React from 'react';

interface AlertsEmptyStateProps {
  onBackToFeed: () => void;
  onConfigureRules: () => void;
  trackedDomainsCount: number;
}

export const AlertsEmptyState: React.FC<AlertsEmptyStateProps> = ({
  onBackToFeed,
  onConfigureRules,
  trackedDomainsCount,
}) => {
  return (
    <div className="flex flex-col gap-unit-lg w-full">
      {/* Healthy Metric Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-unit-sm">
        {/* Card 1 */}
        <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-micro flex flex-col justify-between border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-caption-xs text-caption-xs font-semibold uppercase tracking-wider text-secondary">
              Active Alerts
            </span>
            <div className="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[15px] text-primary">
                notifications_off
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-unit-sm">
            <span className="font-headline-md text-headline-md text-on-surface font-semibold">
              0
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary font-medium">
              No issues
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-micro flex flex-col justify-between border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-caption-xs text-caption-xs font-semibold uppercase tracking-wider text-secondary">
              Requiring Attention
            </span>
            <div className="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[15px] text-primary">
                verified
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-unit-sm">
            <span className="font-headline-md text-headline-md text-on-surface font-semibold">
              0
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary font-medium">
              All clear
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-micro flex flex-col justify-between border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-caption-xs text-caption-xs font-semibold uppercase tracking-wider text-secondary">
              Tracked Domains
            </span>
            <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-[15px] text-on-surface-variant">
                dns
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-unit-sm">
            <span className="font-headline-md text-headline-md text-on-surface font-semibold">
              {trackedDomainsCount}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary font-medium">
              Portfolio records
            </span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-surface-container-lowest p-unit-md rounded-xl shadow-micro flex flex-col justify-between border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-caption-xs text-caption-xs font-semibold uppercase tracking-wider text-primary">
              Portfolio Status
            </span>
            <div className="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[15px] text-primary">
                check_circle
              </span>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-unit-sm">
            <span className="font-headline-md text-headline-md text-primary font-bold">
              Healthy
            </span>
            <span className="font-caption-xs text-caption-xs text-primary font-medium">
              Preview status
            </span>
          </div>
        </div>
      </div>

      {/* Serene Empty State Container */}
      <div className="bg-surface-container-lowest p-unit-2xl rounded-xl shadow-micro flex flex-col items-center justify-center text-center w-full border border-outline-variant/30 py-16">
        <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mb-unit-base">
          <span className="material-symbols-outlined text-[32px] text-primary">
            verified_user
          </span>
        </div>

        <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-unit-xs">
          Preview: Your portfolio is healthy
        </h2>

        <p className="font-body-md text-body-md text-on-surface font-medium mb-unit-xs">
          Preview: No alerts match this view.
        </p>

        <p className="font-body-sm text-body-sm text-secondary max-w-md mb-unit-lg">
          DomainPulse surfaces renewal and health alerts here based on stored portfolio records.
        </p>

        <div className="flex items-center gap-unit-sm">
          <button
            type="button"
            onClick={onBackToFeed}
            className="h-9 px-unit-md rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-xs cursor-pointer"
          >
            Back to Active Alerts
          </button>
          <button
            type="button"
            onClick={onConfigureRules}
            className="h-9 px-unit-md rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors cursor-pointer border border-outline-variant/20"
          >
            Configure Alert Rules
          </button>
        </div>
      </div>
    </div>
  );
};
