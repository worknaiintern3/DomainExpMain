import React, { useState, useEffect } from 'react';
import { ProviderAccountDetail } from '../providerAccountDetails.types';

interface ProviderAccountEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: ProviderAccountDetail;
  onSave: (updated: Partial<ProviderAccountDetail>) => void;
}

export const ProviderAccountEditModal: React.FC<ProviderAccountEditModalProps> = ({
  isOpen,
  onClose,
  account,
  onSave,
}) => {
  const [accountName, setAccountName] = useState(account.accountName);
  const [accountEmail, setAccountEmail] = useState(account.accountEmail);
  const [accountScope, setAccountScope] = useState(account.accountScope);
  const [autoRenewStatus, setAutoRenewStatus] = useState(account.billing.autoRenewStatus);
  const [notes, setNotes] = useState(account.notes);

  useEffect(() => {
    if (isOpen) {
      setAccountName(account.accountName);
      setAccountEmail(account.accountEmail);
      setAccountScope(account.accountScope);
      setAutoRenewStatus(account.billing.autoRenewStatus);
      setNotes(account.notes);
    }
  }, [isOpen, account]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      accountName,
      accountEmail,
      accountScope,
      notes,
      billing: {
        ...account.billing,
        autoRenewStatus,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-unit-md border-b border-surface-container">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">tune</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Edit Account Metadata
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-secondary hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-unit-md flex flex-col gap-unit-md">
          <div className="flex flex-col gap-1">
            <label className="text-caption-xs font-caption-xs font-semibold text-secondary uppercase tracking-wider">
              Account Display Label
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              required
              className="h-9 px-3 rounded-lg bg-surface-container-low border border-outline-variant/60 text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-unit-md">
            <div className="flex flex-col gap-1">
              <label className="text-caption-xs font-caption-xs font-semibold text-secondary uppercase tracking-wider">
                Account Email (Owner)
              </label>
              <input
                type="email"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                required
                className="h-9 px-3 rounded-lg bg-surface-container-low border border-outline-variant/60 text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-mono text-[13px]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-caption-xs font-caption-xs font-semibold text-secondary uppercase tracking-wider">
                Account Scope
              </label>
              <input
                type="text"
                value={accountScope}
                onChange={(e) => setAccountScope(e.target.value)}
                className="h-9 px-3 rounded-lg bg-surface-container-low border border-outline-variant/60 text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-caption-xs font-caption-xs font-semibold text-secondary uppercase tracking-wider">
              Stored Auto-Renew Preference
            </label>
            <select
              value={autoRenewStatus}
              onChange={(e) => setAutoRenewStatus(e.target.value)}
              className="h-9 px-3 rounded-lg bg-surface-container-low border border-outline-variant/60 text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              <option value="User Mapped On">User Mapped On</option>
              <option value="User Mapped Off">User Mapped Off</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-caption-xs font-caption-xs font-semibold text-secondary uppercase tracking-wider">
              Operational SOP &amp; Account Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/60 text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="p-unit-xs rounded bg-surface-container text-caption-xs font-caption-xs text-secondary">
            Note: Changes will update your active in-memory session record. No remote provider data or credentials are ever touched.
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-unit-xs pt-unit-xs border-t border-surface-container">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-unit-md rounded-lg text-secondary hover:bg-surface-container text-label-md font-label-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary hover:bg-tertiary text-label-md font-label-md font-medium transition-colors shadow-sm cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
