import React, { useState, useEffect } from 'react';
import { DomainDetailData } from '../domainDetails.types';

interface EditMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DomainDetailData;
  onSave: (updated: Partial<DomainDetailData>) => void;
}

export const EditMetadataModal: React.FC<EditMetadataModalProps> = ({
  isOpen,
  onClose,
  data,
  onSave,
}) => {
  const [registrantEmail, setRegistrantEmail] = useState(data.registrantEmail);
  const [registrarTenant, setRegistrarTenant] = useState(data.registrarTenant);
  const [targetAppName, setTargetAppName] = useState(data.targetAppName);
  const [targetAppUrl, setTargetAppUrl] = useState(data.targetAppUrl);
  const [autoRenew, setAutoRenew] = useState(data.autoRenew);
  const [userNotes, setUserNotes] = useState(data.userNotes || '');

  useEffect(() => {
    if (isOpen) {
      setRegistrantEmail(data.registrantEmail);
      setRegistrarTenant(data.registrarTenant);
      setTargetAppName(data.targetAppName);
      setTargetAppUrl(data.targetAppUrl);
      setAutoRenew(data.autoRenew);
      setUserNotes(data.userNotes || '');
    }
  }, [isOpen, data]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      registrantEmail,
      registrarTenant,
      targetAppName,
      targetAppUrl,
      autoRenew,
      userNotes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-unit-md animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-xl bg-surface-container-lowest rounded-xl shadow-2xl p-unit-xl flex flex-col gap-unit-md border border-outline-variant/40 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex flex-col">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">tune</span>
              <span>Edit Domain Metadata</span>
            </h3>
            <p className="font-caption-xs text-caption-xs text-secondary font-label-mono">
              {data.domain} • User Mapped Reference Attributes
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container text-secondary hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-unit-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
                Registrant Account Email
              </label>
              <input
                type="email"
                value={registrantEmail}
                onChange={(e) => setRegistrantEmail(e.target.value)}
                required
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
                Tenant / Account Label
              </label>
              <input
                type="text"
                value={registrarTenant}
                onChange={(e) => setRegistrarTenant(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
                Target Application
              </label>
              <input
                type="text"
                value={targetAppName}
                onChange={(e) => setTargetAppName(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
                Target URL
              </label>
              <input
                type="url"
                value={targetAppUrl}
                onChange={(e) => setTargetAppUrl(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/30">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Auto-Renew Status
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Stored portfolio preference
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoRenew}
              onChange={(e) => setAutoRenew(e.target.checked)}
              className="w-4 h-4 accent-primary rounded cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
              Operational Notes &amp; Directives
            </label>
            <textarea
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              rows={3}
              placeholder="Add infrastructure notes, responsible owner, or maintenance schedule..."
              className="p-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none border border-outline-variant/30"
            />
          </div>

          <div className="flex items-center justify-end gap-unit-sm pt-unit-sm border-t border-surface-container">
            <button
              onClick={onClose}
              className="h-9 px-unit-lg rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors border border-outline-variant/30"
              type="button"
            >
              Cancel
            </button>
            <button
              className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm transition-colors"
              type="submit"
            >
              Save Metadata
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
