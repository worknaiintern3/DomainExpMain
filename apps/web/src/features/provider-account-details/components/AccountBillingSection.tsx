import React from 'react';
import { AccountBillingRecord } from '../providerAccountDetails.types';

interface AccountBillingSectionProps {
  billing: AccountBillingRecord;
}

export const AccountBillingSection: React.FC<AccountBillingSectionProps> = ({ billing }) => {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-unit-md shadow-sm border border-outline-variant/30">
      <div className="flex items-center gap-unit-xs mb-unit-sm">
        <span className="material-symbols-outlined text-primary text-[20px]">credit_card</span>
        <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
          Billing &amp; Financials
        </h2>
      </div>

      <div className="space-y-unit-sm">
        {/* Billing Contact */}
        <div className="p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs text-secondary block uppercase tracking-wider">
            Billing Contact
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="font-label-mono text-label-mono font-medium text-on-surface">
              {billing.billingContact}
            </span>
            <span className="material-symbols-outlined text-[16px] text-primary" title="Stored Contact">
              contact_mail
            </span>
          </div>
        </div>

        {/* Billing Currency & Cycle */}
        <div className="p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-caption-xs text-caption-xs text-secondary block uppercase tracking-wider">
                Billing Currency
              </span>
              <span className="font-label-md text-label-md font-semibold text-on-surface mt-0.5 block">
                {billing.currency}
              </span>
            </div>
            <div className="text-right">
              <span className="font-caption-xs text-caption-xs text-secondary block uppercase tracking-wider">
                Auto-Renew Preference
              </span>
              <span className="font-caption-xs text-caption-xs px-2 py-0.5 rounded bg-surface-container text-primary font-medium mt-0.5 inline-block">
                {billing.autoRenewStatus}
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-surface-container text-caption-xs font-caption-xs text-secondary flex justify-between">
            <span>Billing Cycle:</span>
            <span className="text-on-surface font-medium">{billing.billingCycle}</span>
          </div>
          <div className="mt-1 flex justify-between text-caption-xs font-caption-xs text-secondary">
            <span>Next Renewal:</span>
            <span className="font-mono text-on-surface font-medium">{billing.nextRenewalFormatted}</span>
          </div>
        </div>

        {/* Tax Invoice Profile */}
        <div className="p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs text-secondary block uppercase tracking-wider">
            Tax &amp; Invoice Profile
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="font-label-md text-label-md font-semibold text-on-surface">
              {billing.taxEntityName}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary bg-surface-container px-1.5 py-0.2 rounded font-medium">
              {billing.taxStatusBadge}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-caption-xs font-caption-xs text-secondary font-mono">
            <span>{billing.gstinNumber}</span>
          </div>
        </div>

        {/* Recent Invoices list */}
        {billing.recentInvoices.length > 0 && (
          <div className="pt-unit-xs">
            <span className="font-caption-xs text-caption-xs text-secondary uppercase font-semibold tracking-wider">
              Reference Account Invoices
            </span>
            <div className="mt-unit-xs space-y-1.5">
              {billing.recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between py-1 px-2 rounded bg-surface-container-low border border-outline-variant/20 text-caption-xs font-caption-xs"
                >
                  <div className="flex items-center gap-1.5 font-mono text-on-surface">
                    <span className="material-symbols-outlined text-[14px] text-secondary">
                      receipt_long
                    </span>
                    <span>{inv.invoiceNumber}</span>
                  </div>
                  <span className="font-label-mono text-label-mono text-on-surface font-medium">
                    {inv.amountFormatted}
                  </span>
                  <span className="text-secondary font-medium">{inv.statusText}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
