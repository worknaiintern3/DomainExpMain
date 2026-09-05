import React, { useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { StatusBadge } from '@/components/common/StatusBadge';

export const SettingsPage: React.FC = () => {
  const [currency, setCurrency] = useState('INR');

  return (
    <div className="flex flex-col gap-unit-lg">
      <PageHeader
        title="Settings"
        badge="Workspace Config"
        description="Configure workspace preferences, default currency denomination, table pagination density, and portfolio backup tools."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-unit-lg">
        {/* Left Navigation Card */}
        <div className="p-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-1">
          <button className="flex items-center gap-unit-sm px-3 py-2 rounded-lg bg-primary-container text-white font-label-md text-label-md font-medium text-left">
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>General Preferences</span>
          </button>
          <button className="flex items-center gap-unit-sm px-3 py-2 rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface font-label-md text-label-md font-medium text-left transition-colors">
            <span className="material-symbols-outlined text-[18px]">palette</span>
            <span>Appearance &amp; Density</span>
          </button>
          <button className="flex items-center gap-unit-sm px-3 py-2 rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface font-label-md text-label-md font-medium text-left transition-colors">
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            <span>Alert &amp; Expiry Rules</span>
          </button>
          <button className="flex items-center gap-unit-sm px-3 py-2 rounded-lg text-secondary hover:bg-surface-container hover:text-on-surface font-label-md text-label-md font-medium text-left transition-colors">
            <span className="material-symbols-outlined text-[18px]">dataset</span>
            <span>Data Management</span>
          </button>
        </div>

        {/* Right Settings Form Card */}
        <div className="lg:col-span-2 p-unit-lg rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro flex flex-col gap-unit-md">
          <div className="flex items-center justify-between pb-unit-sm border-b border-outline-variant/40">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              General Preferences
            </h3>
            <StatusBadge status="healthy" label="Portfolio Workspace Active" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
                Display Name
              </label>
              <input
                type="text"
                defaultValue="Aman Developer"
                className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
                Default Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/60 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-unit-sm border-t border-outline-variant/40">
            <Button variant="primary" size="md">
              Save Preferences
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
