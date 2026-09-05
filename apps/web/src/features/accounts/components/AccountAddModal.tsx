import React, { useState, useEffect } from 'react';
import { ProviderAccount } from '../accounts.types';

interface AccountAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ProviderAccount>) => void;
  editAccount?: ProviderAccount | null;
  defaultEmail?: string;
  defaultProvider?: string;
}

export const AccountAddModal: React.FC<AccountAddModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editAccount,
  defaultEmail,
  defaultProvider,
}) => {
  const [providerCompany, setProviderCompany] = useState('GoDaddy');
  const [accountName, setAccountName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accountEmail, setAccountEmail] = useState('domains@worknai.com');
  const [project, setProject] = useState('WorknAi');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editAccount) {
      setProviderCompany(editAccount.providerCompany);
      setAccountName(editAccount.accountName);
      setAccountId(editAccount.accountId);
      setAccountEmail(editAccount.accountEmail);
      setProject(editAccount.project || 'WorknAi');
      setNotes(editAccount.notes || '');
    } else {
      setProviderCompany(defaultProvider || 'GoDaddy');
      setAccountName('');
      setAccountId('');
      setAccountEmail(defaultEmail || 'domains@worknai.com');
      setProject('WorknAi');
      setNotes('');
    }
  }, [editAccount, isOpen, defaultEmail, defaultProvider]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const logoLetter = providerCompany.slice(0, 2).toUpperCase();
    onSubmit({
      providerCompany,
      accountName: accountName || `${providerCompany} Account`,
      accountId: accountId || `${logoLetter}-${Math.floor(10000 + Math.random() * 90000)}`,
      accountEmail,
      project,
      notes,
      logoLetter,
      logoBgColor: 'bg-primary-fixed',
      logoTextColor: 'text-primary',
      mappingStatus: 'mapped',
      mappingStatusLabel: 'User Mapped',
      domainsCount: editAccount ? editAccount.domainsCount : 0,
      serversCount: editAccount ? editAccount.serversCount : 0,
      websitesCount: editAccount ? editAccount.websitesCount : 0,
      sampleAssets: editAccount ? editAccount.sampleAssets : ['New Mapped Asset'],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-unit-md animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-xl shadow-2xl p-unit-xl flex flex-col gap-unit-md border border-outline-variant/40 z-10 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex flex-col">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              {editAccount ? 'Edit Provider Account Mapping' : 'Link Provider Account'}
            </h3>
            <p className="font-caption-xs text-caption-xs text-secondary">
              Map registrar, VPS host, or DNS provider accounts to a responsible email address.
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
            {/* Provider Company */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Provider Company *
              </label>
              <select
                value={providerCompany}
                onChange={(e) => setProviderCompany(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer border border-outline-variant/30"
              >
                <option value="GoDaddy">GoDaddy</option>
                <option value="Namecheap">Namecheap</option>
                <option value="Hostinger">Hostinger</option>
                <option value="DigitalOcean">DigitalOcean</option>
                <option value="Hetzner Cloud">Hetzner Cloud</option>
                <option value="Vultr">Vultr</option>
                <option value="Cloudflare">Cloudflare</option>
                <option value="Amazon Web Services">AWS</option>
                <option value="Google Cloud Platform">GCP</option>
                <option value="Custom Provider">Custom Provider</option>
              </select>
            </div>

            {/* Account Name */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Account Label *
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. WorknAi Main"
                required
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Account Identifier */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Account Identifier (Optional)
              </label>
              <input
                type="text"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="e.g. GD-89104"
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Registered Account Email */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Associated Email Address *
              </label>
              <input
                type="email"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                placeholder="infra@worknai.com"
                required
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Project Group */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Project Group
              </label>
              <input
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="e.g. WorknAi"
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Account Reference Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes on usage, billing owner, or renewal cadence..."
                rows={2}
                className="p-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none border border-outline-variant/30"
              />
            </div>
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
              {editAccount ? 'Save Changes' : 'Link Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
