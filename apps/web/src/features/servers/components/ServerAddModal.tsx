import React, { useState, useEffect } from 'react';
import { ServerRecord } from '../servers.types';

interface ServerAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (serverData: Partial<ServerRecord>) => void;
  editServer?: ServerRecord | null;
}

export const ServerAddModal: React.FC<ServerAddModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editServer,
}) => {
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [provider, setProvider] = useState('Hostinger');
  const [accountName, setAccountName] = useState('WorknAi Hostinger Main');
  const [accountEmail, setAccountEmail] = useState('infra@worknai.com');
  const [ipAddress, setIpAddress] = useState('');
  const [region, setRegion] = useState('Singapore');
  const [vcpuCount, setVcpuCount] = useState('4');
  const [ramGb, setRamGb] = useState('8');
  const [storageGb, setStorageGb] = useState('160');
  const [monthlyCost, setMonthlyCost] = useState('1499');
  const [renewalDate, setRenewalDate] = useState('2026-10-18');
  const [autoRenew, setAutoRenew] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editServer) {
      setName(editServer.name);
      setHostname(editServer.hostname);
      setProvider(editServer.provider);
      setAccountName(editServer.accountName);
      setAccountEmail(editServer.accountEmail);
      setIpAddress(editServer.ipAddress);
      setRegion(editServer.region);
      setVcpuCount(String(editServer.vcpuCount));
      setRamGb(String(editServer.ramGb));
      setStorageGb(String(editServer.storageGb));
      setMonthlyCost(String(editServer.monthlyCost));
      setAutoRenew(editServer.autoRenew);
      setNotes(editServer.notes || '');
    } else {
      setName('');
      setHostname('');
      setProvider('Hostinger');
      setAccountName('WorknAi Hostinger Main');
      setAccountEmail('infra@worknai.com');
      setIpAddress('');
      setRegion('Singapore');
      setVcpuCount('4');
      setRamGb('8');
      setStorageGb('160');
      setMonthlyCost('1499');
      setRenewalDate('2026-10-18');
      setAutoRenew(true);
      setNotes('');
    }
  }, [editServer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      hostname: hostname || `${name.toLowerCase().replace(/\s+/g, '-')}-01`,
      provider,
      accountName,
      accountEmail,
      ipAddress: ipAddress || '103.21.58.112',
      region,
      vcpuCount: Number(vcpuCount) || 2,
      ramGb: Number(ramGb) || 4,
      storageGb: Number(storageGb) || 80,
      computeSpecs: `${vcpuCount} vCPU / ${ramGb} GB / ${storageGb} GB`,
      monthlyCost: Number(monthlyCost) || 999,
      monthlyCostFormatted: `₹${Number(monthlyCost).toLocaleString()}`,
      annualizedRunRateFormatted: `₹${(Number(monthlyCost) * 12).toLocaleString()}/yr`,
      renewalDateFormatted: renewalDate ? '18 Oct 2026' : '18 Oct 2026',
      autoRenew,
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-unit-md animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-xl bg-surface-container-lowest rounded-xl shadow-2xl p-unit-xl flex flex-col gap-unit-md border border-outline-variant/40 z-10 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex flex-col">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              {editServer ? 'Edit Server Record' : 'Add New Server'}
            </h3>
            <p className="font-caption-xs text-caption-xs text-secondary">
              Track cloud compute instances, provider account details, and hosted website bindings.
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
            {/* Server Name */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Server Display Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production VPS 01"
                required
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Hostname */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Hostname
              </label>
              <input
                type="text"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="prod-vps-01"
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Provider */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Provider *
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                required
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer border border-outline-variant/30"
              >
                <option value="Hostinger">Hostinger</option>
                <option value="DigitalOcean">DigitalOcean</option>
                <option value="Vultr">Vultr</option>
                <option value="Hetzner">Hetzner</option>
                <option value="AWS EC2">AWS EC2</option>
                <option value="Linode">Linode / Akamai</option>
                <option value="Other">Other / Dedicated</option>
              </select>
            </div>

            {/* Account Email */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Account Email *
              </label>
              <input
                type="email"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                required
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Public IP */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Public IP Address
              </label>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="103.21.58.112"
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Region */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Datacenter / Region
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer border border-outline-variant/30"
              >
                <option value="Singapore">Singapore (SGP-1)</option>
                <option value="Bangalore">Bangalore (BLR-1)</option>
                <option value="Mumbai">Mumbai (BOM-1)</option>
                <option value="Frankfurt">Frankfurt (FRA-1)</option>
                <option value="US East">US East (N. Virginia)</option>
                <option value="London">London (LHR-1)</option>
              </select>
            </div>

            {/* Compute Specs */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                vCPU &amp; RAM
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={vcpuCount}
                  onChange={(e) => setVcpuCount(e.target.value)}
                  placeholder="4 vCPU"
                  className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
                />
                <input
                  type="number"
                  value={ramGb}
                  onChange={(e) => setRamGb(e.target.value)}
                  placeholder="8 GB"
                  className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
                />
              </div>
            </div>

            {/* Monthly Cost */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Monthly Cost (INR)
              </label>
              <div className="flex items-center gap-1">
                <span className="h-9 px-2.5 rounded-lg bg-surface-container flex items-center justify-center font-label-mono text-caption-xs text-secondary font-bold border border-outline-variant/30">
                  ₹
                </span>
                <input
                  type="number"
                  value={monthlyCost}
                  onChange={(e) => setMonthlyCost(e.target.value)}
                  placeholder="1499"
                  className="h-9 w-full px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
                />
              </div>
            </div>

            {/* Next Renewal Date */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
                Next Renewal Date
              </label>
              <input
                type="date"
                value={renewalDate}
                onChange={(e) => setRenewalDate(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>
          </div>

          {/* Auto Renew & Stored Preference */}
          <div className="flex items-center justify-between p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/30">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface font-medium">
                Auto-Renew Status
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Stored portfolio billing preference
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoRenew}
              onChange={(e) => setAutoRenew(e.target.checked)}
              className="w-4 h-4 accent-primary rounded cursor-pointer"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary">
              Directives &amp; Server Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add infrastructure notes, responsible owner, or deployment instructions..."
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
              {editServer ? 'Save Changes' : 'Add Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
