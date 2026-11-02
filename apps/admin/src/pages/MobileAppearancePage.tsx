import React, { useEffect, useState } from 'react';
import type { MobileAppConfig } from '@domainpulse/contracts';
import { adminClient } from '../api/admin.client';
import { IconPalette, IconCheckCircle } from '../components/Icons';

export const MobileAppearancePage: React.FC = () => {
  const [config, setConfig] = useState<MobileAppConfig>({
    appName: 'DomainPulse',
    logoUrl: null,
    primaryColor: '#00E5FF',
    secondaryColor: '#0D222E',
    maintenanceMode: false,
    maintenanceMessage: null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    adminClient
      .getConfig()
      .then(setConfig)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const updated = await adminClient.updateConfig({
        appName: config.appName,
        logoUrl: config.logoUrl || null,
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor,
        maintenanceMessage: config.maintenanceMessage || null,
      });
      setConfig(updated);
      setToast('Appearance settings saved and pushed to mobile client');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Failed to update appearance settings');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400 text-xs">Loading appearance configuration...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <IconPalette size={24} className="text-blue-500" />
          Mobile App Appearance & Branding
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Customise mobile branding, primary accents, splash screen, and maintenance copy dynamically.
        </p>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
          <IconCheckCircle size={16} />
          {toast}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Branding Metadata
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Application Name</label>
            <input
              type="text"
              value={config.appName}
              onChange={(e) => setConfig({ ...config, appName: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Logo URL (Optional)</label>
            <input
              type="url"
              value={config.logoUrl || ''}
              onChange={(e) => setConfig({ ...config, logoUrl: e.target.value || null })}
              placeholder="https://domainpulse.io/logo.png"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Maintenance Notice Banner Message</label>
            <textarea
              value={config.maintenanceMessage || ''}
              onChange={(e) => setConfig({ ...config, maintenanceMessage: e.target.value || null })}
              placeholder="Optional message shown when maintenance mode is active"
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Color Palette & Tokens
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Primary Color (HEX)</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.primaryColor}
                onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
              />
              <input
                type="text"
                value={config.primaryColor}
                onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Secondary / Dark Base Color (HEX)</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.secondaryColor}
                onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
              />
              <input
                type="text"
                value={config.secondaryColor}
                onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Live Mobile Screen Preview */}
          <div className="pt-2">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Live Mobile Color Preview</span>
            <div
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-white flex items-center justify-between"
              style={{ backgroundColor: config.secondaryColor }}
            >
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: config.primaryColor }} />
                <span className="font-bold text-xs">{config.appName}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ backgroundColor: config.primaryColor, color: config.secondaryColor }}>
                Accent Preview
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            {isSaving ? 'Pushing to Mobile...' : 'Save Appearance Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};
