import React, { useEffect, useState } from 'react';
import type { MobileAppConfig } from '@domainpulse/contracts';
import { mobileAdminClient } from '../api/mobile-admin.client';

export const MobileAppearancePage: React.FC = () => {
  const [config, setConfig] = useState<MobileAppConfig>({
    appName: 'DomainPulse',
    logoUrl: null,
    primaryColor: '#2563EB',
    secondaryColor: '#1E293B',
    maintenanceMode: false,
    maintenanceMessage: null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    mobileAdminClient
      .getConfig()
      .then(setConfig)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const updated = await mobileAdminClient.updateConfig({
        appName: config.appName,
        logoUrl: config.logoUrl || null,
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor,
        maintenanceMessage: config.maintenanceMessage || null,
      });
      setConfig(updated);
      setToast('✅ Appearance settings saved and pushed to mobile client');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('❌ Failed to update appearance settings');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading appearance configuration...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Appearance & Branding</h2>
        <p className="text-sm text-slate-400 mt-1">
          Customise mobile branding, primary accents, and maintenance copy dynamically.
        </p>
      </div>

      {toast && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium">
          {toast}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4 shadow-xl">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Branding Metadata</h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Application Name</label>
            <input
              type="text"
              value={config.appName}
              onChange={(e) => setConfig({ ...config, appName: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Logo URL (Optional)</label>
            <input
              type="url"
              value={config.logoUrl || ''}
              onChange={(e) => setConfig({ ...config, logoUrl: e.target.value || null })}
              placeholder="https://domainpulse.io/logo.png"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Maintenance Notice Banner Message</label>
            <textarea
              value={config.maintenanceMessage || ''}
              onChange={(e) => setConfig({ ...config, maintenanceMessage: e.target.value || null })}
              placeholder="Optional message shown when maintenance mode is active"
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4 shadow-xl">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Color Palette</h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Primary Color (HEX)</label>
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
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
                pattern="^#[0-9a-fA-F]{6}$"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Secondary Color (HEX)</label>
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
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-blue-500 transition-colors"
                pattern="^#[0-9a-fA-F]{6}$"
                required
              />
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="pt-4 border-t border-slate-800">
            <div className="text-xs font-semibold text-slate-400 mb-2">Live UI Preview</div>
            <div
              className="p-4 rounded-xl text-white font-medium text-sm flex items-center justify-between shadow-md"
              style={{ backgroundColor: config.primaryColor }}
            >
              <span>{config.appName} Active Theme</span>
              <span className="text-xs bg-white/20 px-2 py-1 rounded">Sample Button</span>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {isSaving ? 'Saving Changes...' : 'Save Appearance Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
