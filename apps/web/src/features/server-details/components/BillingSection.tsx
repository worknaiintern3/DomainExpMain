import React from 'react';
import { BillingRenewalData } from '../serverDetails.types';

interface BillingSectionProps {
  billing: BillingRenewalData;
}

export const BillingSection: React.FC<BillingSectionProps> = ({ billing }) => {
  return (
    <div className="rounded-xl bg-surface-container-lowest shadow-sm flex flex-col border border-outline-variant/30">
      {/* Card Header */}
      <div className="p-unit-md flex items-center justify-between bg-surface-container-low rounded-t-xl border-b border-outline-variant/30">
        <div className="flex items-center gap-unit-sm">
          <span className="material-symbols-outlined text-primary text-[20px]">credit_card</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Billing &amp; Renewal Details
          </h2>
        </div>
      </div>

      {/* Billing Fields */}
      <div className="p-unit-md flex flex-col gap-unit-md font-body-sm text-body-sm">
        {/* Account Mapping */}
        <div className="flex flex-col gap-unit-2xs">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase tracking-wider font-semibold">
            Cloud / Registrar Account
          </span>
          <span className="font-medium text-on-surface">{billing.accountName}</span>
        </div>

        {/* Billing Schedule */}
        <div className="flex flex-col gap-unit-2xs">
          <span className="font-caption-xs text-caption-xs text-secondary uppercase tracking-wider font-semibold">
            Billing Frequency
          </span>
          <div className="flex items-center justify-between">
            <span className="font-medium text-on-surface">{billing.billingFrequency}</span>
            <span className="px-unit-xs py-unit-2xs rounded bg-surface-container-high text-primary font-caption-xs text-caption-xs font-semibold border border-primary/20">
              {billing.autoRenew ? 'User Marked On' : 'User Marked Off'}
            </span>
          </div>
        </div>

        {/* Renewal Reminder Preference Box */}
        <div className="p-unit-sm rounded-lg bg-surface-container-low flex flex-col gap-unit-xs border border-outline-variant/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-unit-xs text-primary font-label-md text-label-md">
              <span className="material-symbols-outlined text-[16px]">forward_to_inbox</span>
              <span className="font-semibold">Renewal Reminder Preference</span>
            </div>
            <span className="px-unit-xs py-0.5 rounded bg-surface-container-highest text-secondary font-caption-xs text-caption-xs font-medium border border-outline-variant/20">
              Delivery: Not Connected
            </span>
          </div>
          <div className="flex flex-col gap-0.5 text-secondary font-caption-xs text-caption-xs mt-0.5 leading-relaxed">
            <div>
              Preference window:{' '}
              <span className="text-on-surface font-semibold">{billing.notificationLeadDays} days</span> in advance.
            </div>
            <div>
              Target Email:{' '}
              <span className="font-label-mono text-on-surface font-semibold">
                {billing.notificationEmail}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
