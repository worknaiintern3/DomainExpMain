import React, { useState, useEffect } from 'react';
import { ServerDetailData } from '../serverDetails.types';

interface ServerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ServerDetailData;
  onSave: (updated: Partial<ServerDetailData>) => void;
}

export const ServerEditModal: React.FC<ServerEditModalProps> = ({
  isOpen,
  onClose,
  data,
  onSave,
}) => {
  const [name, setName] = useState(data.name);
  const [hostname, setHostname] = useState(data.hostname);
  const [provider, setProvider] = useState(data.provider);
  const [providerAccountName, setProviderAccountName] = useState(data.providerAccountName);
  const [accountEmail, setAccountEmail] = useState(data.accountEmail);
  const [ipAddress, setIpAddress] = useState(data.ipAddress);
  const [region, setRegion] = useState(data.region);
  const [osPlatform, setOsPlatform] = useState(data.osPlatform);
  const [vcpuCount, setVcpuCount] = useState(String(data.vcpuCount));
  const [ramGb, setRamGb] = useState(String(data.ramGb));
  const [storageGb, setStorageGb] = useState(String(data.storageGb));
  const [project, setProject] = useState(data.project);
  const [notes, setNotes] = useState(data.notes || '');

  useEffect(() => {
    if (isOpen) {
      setName(data.name);
      setHostname(data.hostname);
      setProvider(data.provider);
      setProviderAccountName(data.providerAccountName);
      setAccountEmail(data.accountEmail);
      setIpAddress(data.ipAddress);
      setRegion(data.region);
      setOsPlatform(data.osPlatform);
      setVcpuCount(String(data.vcpuCount));
      setRamGb(String(data.ramGb));
      setStorageGb(String(data.storageGb));
      setProject(data.project);
      setNotes(data.notes || '');
    }
  }, [isOpen, data]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      hostname,
      provider,
      providerAccountName,
      accountEmail,
      ipAddress,
      region,
      osPlatform,
      vcpuCount: Number(vcpuCount) || data.vcpuCount,
      ramGb: Number(ramGb) || data.ramGb,
      storageGb: Number(storageGb) || data.storageGb,
      computeSpecs: `${vcpuCount} vCPU / ${ramGb} GB / ${storageGb} GB`,
      project,
      notes,
      specs: [
        { label: 'Compute', value: `${vcpuCount} vCPU`, badge: 'User Added' },
        { label: 'Memory', value: `${ramGb} GB RAM`, badge: 'User Added' },
        { label: 'Storage', value: `${storageGb} GB`, badge: 'User Added' },
        { label: 'Operating System', value: osPlatform, badge: 'User Added' },
        { label: 'Public IP', value: ipAddress, badge: 'Stored Provider Data', isMono: true },
        { label: 'Region', value: region, badge: 'Stored Provider Data' },
      ],
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
              Edit Server Inventory Record
            </h3>
            <p className="font-caption-xs text-caption-xs text-secondary">
              Update compute specifications, provider account details, and server directives.
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
            {/* Server Display Name */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Server Display Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Hostname */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Hostname
              </label>
              <input
                type="text"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Provider */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Cloud Provider *
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

            {/* Provider Account Name */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Provider Account Name
              </label>
              <input
                type="text"
                value={providerAccountName}
                onChange={(e) => setProviderAccountName(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Account Email */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
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
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Public IP Address
              </label>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Region */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Region / Datacenter
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* OS Platform */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                OS Platform
              </label>
              <input
                type="text"
                value={osPlatform}
                onChange={(e) => setOsPlatform(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Compute Specs */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                vCPU &amp; RAM
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={vcpuCount}
                  onChange={(e) => setVcpuCount(e.target.value)}
                  placeholder="vCPU"
                  className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
                />
                <input
                  type="number"
                  value={ramGb}
                  onChange={(e) => setRamGb(e.target.value)}
                  placeholder="RAM (GB)"
                  className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
                />
              </div>
            </div>

            {/* Storage */}
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Storage Allocation (GB)
              </label>
              <input
                type="number"
                value={storageGb}
                onChange={(e) => setStorageGb(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-label-mono text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>

            {/* Project */}
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
                Associated Project
              </label>
              <input
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="h-9 px-unit-sm rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
            </div>
          </div>

          {/* Directives & Server Notes */}
          <div className="flex flex-col gap-1">
            <label className="font-caption-xs text-caption-xs font-label-md uppercase tracking-wider text-secondary font-semibold">
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
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
