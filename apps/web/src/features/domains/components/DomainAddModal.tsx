import React, { useState, useEffect } from 'react';
import { DomainRecord } from '../domains.types';

interface DomainAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (domainData: Partial<DomainRecord>) => void;
  editDomain?: DomainRecord | null;
}

export const DomainAddModal: React.FC<DomainAddModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editDomain,
}) => {
  const [domainName, setDomainName] = useState('');
  const [registrar, setRegistrar] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [renewalPrice, setRenewalPrice] = useState('1299');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);
  const [projectTag, setProjectTag] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editDomain) {
      setDomainName(editDomain.domain);
      setRegistrar(editDomain.registrar);
      setRenewalPrice(String(editDomain.renewalCost));
      setAutoRenew(editDomain.autoRenew);
      setProjectTag(editDomain.projectTag);
      setNotes(editDomain.notes || '');
    } else {
      setDomainName('');
      setRegistrar('GoDaddy');
      setExpiryDate('');
      setRenewalPrice('1299');
      setPurchasePrice('');
      setAutoRenew(true);
      setProjectTag('WorknAi');
      setNotes('');
    }
  }, [editDomain, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      domain: domainName,
      registrar,
      renewalCost: Number(renewalPrice) || 1299,
      renewalCostFormatted: `₹${Number(renewalPrice).toLocaleString()}`,
      autoRenew,
      projectTag: projectTag || 'General',
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-unit-md animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl bg-surface-container-lowest rounded-xl shadow-2xl p-unit-xl flex flex-col gap-unit-md border border-outline-variant/40 z-10 animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex flex-col">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              {editDomain ? 'Edit Domain Record' : 'Add New Domain'}
            </h3>
            <p className="font-caption-xs text-caption-xs text-secondary">
              Track DNS, renewal deadlines and portfolio records.
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

        {/* Modal Form Grid */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-unit-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
            {/* Domain Name */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Domain Name *
              </label>
              <input
                type="text"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
                placeholder="example.com"
                required
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Registrar */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Registrar *
              </label>
              <select
                value={registrar}
                onChange={(e) => setRegistrar(e.target.value)}
                required
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer border border-outline-variant/30"
              >
                <option value="">Select registrar...</option>
                <option value="GoDaddy">GoDaddy</option>
                <option value="Cloudflare">Cloudflare</option>
                <option value="Hostinger">Hostinger</option>
                <option value="Namecheap">Namecheap</option>
                <option value="Porkbun">Porkbun</option>
                <option value="Other / Self-Hosted">Other / Self-Hosted</option>
              </select>
            </div>

            {/* Registration Date */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Registration Date
              </label>
              <input
                type="date"
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Expiry Date */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Expiry Date *
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required={!editDomain}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Purchase Price */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Purchase Price
              </label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="₹1,299"
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Renewal Price & Currency */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Renewal Price (INR) *
              </label>
              <div className="flex items-center gap-1">
                <span className="h-9 px-2.5 rounded-lg bg-surface-container flex items-center justify-center font-label-mono text-caption-xs text-secondary font-bold border border-outline-variant/30">
                  ₹
                </span>
                <input
                  type="number"
                  value={renewalPrice}
                  onChange={(e) => setRenewalPrice(e.target.value)}
                  placeholder="1299"
                  required
                  className="h-9 w-full px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
                />
              </div>
            </div>
          </div>

          {/* Auto Renew Toggle & Project / Client Tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md items-center pt-unit-xs">
            <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/30">
              <div className="flex flex-col">
                <span className="font-label-md text-label-md text-on-surface font-medium">
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
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Project / Client Tags
              </label>
              <input
                type="text"
                value={projectTag}
                onChange={(e) => setProjectTag(e.target.value)}
                placeholder="e.g. WorknAi, Production"
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>
          </div>

          {/* Operational Notes */}
          <div className="flex flex-col gap-1">
            <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
              Notes &amp; Directives
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add administrative notes, responsible owner, or DNS records notes..."
              rows={2}
              className="p-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none border border-outline-variant/30"
            />
          </div>

          {/* Modal Actions */}
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
              {editDomain ? 'Save Changes' : 'Add Domain'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
