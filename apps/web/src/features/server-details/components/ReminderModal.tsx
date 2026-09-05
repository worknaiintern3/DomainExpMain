import React, { useState } from 'react';
import { BillingRenewalData } from '../serverDetails.types';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverName: string;
  billing: BillingRenewalData;
  onSaveReminder: (leadDays: number, email: string) => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  serverName,
  billing,
  onSaveReminder,
}) => {
  const [leadDays, setLeadDays] = useState(billing.notificationLeadDays || 14);
  const [email, setEmail] = useState(billing.notificationEmail || billing.accountEmail);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveReminder(leadDays, email);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-unit-md animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-surface-container-lowest rounded-xl shadow-2xl p-unit-lg flex flex-col gap-unit-md border border-outline-variant/40 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex items-center gap-unit-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">alarm</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Renewal Reminder
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container text-secondary hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <p className="font-body-sm text-body-sm text-secondary">
          Configure advance renewal alerts for <strong className="text-on-surface">{serverName}</strong>.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-unit-md">
          {/* Target Notification Email */}
          <div className="flex flex-col gap-1">
            <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
              Notification Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
            />
          </div>

          {/* Advance Lead Time */}
          <div className="flex flex-col gap-1">
            <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
              Advance Notification Window
            </label>
            <select
              value={leadDays}
              onChange={(e) => setLeadDays(Number(e.target.value))}
              className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer border border-outline-variant/30"
            >
              <option value={7}>7 days in advance</option>
              <option value={14}>14 days in advance (Recommended)</option>
              <option value={30}>30 days in advance</option>
              <option value={60}>60 days in advance</option>
            </select>
          </div>

          {/* Next Cycle Info */}
          <div className="p-unit-sm rounded-lg bg-surface-container-low flex items-center justify-between border border-outline-variant/20 font-caption-xs text-caption-xs">
            <span className="text-secondary">Next Renewal Date:</span>
            <span className="font-label-mono font-bold text-on-surface">
              {billing.renewalDateFormatted}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-unit-sm pt-unit-sm border-t border-surface-container">
            <button
              onClick={onClose}
              className="h-9 px-unit-md rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors border border-outline-variant/30"
              type="button"
            >
              Cancel
            </button>
            <button
              className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm transition-colors flex items-center gap-1"
              type="submit"
            >
              {isSaved ? (
                <>
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Saved!</span>
                </>
              ) : (
                <span>Set Reminder</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
