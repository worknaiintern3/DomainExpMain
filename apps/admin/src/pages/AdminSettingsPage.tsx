import React, { useState } from 'react';
import { adminClient } from '../api/admin.client';
import {
  IconCheckCircle,
  IconKey,
  IconSun,
} from '../components/Icons';
import { useTheme } from '../context/ThemeContext';

export const AdminSettingsPage: React.FC = () => {
  const { theme, setTheme, actualTheme } = useTheme();
  const [tokenInput, setTokenInput] = useState(adminClient.getToken() || '');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleSaveToken = () => {
    if (tokenInput.trim()) {
      adminClient.setToken(tokenInput.trim());
    } else {
      adminClient.clearToken();
    }
    setSavedNotice('Admin security token updated.');
    setTimeout(() => {
      setSavedNotice(null);
      window.location.reload();
    }, 1000);
  };

  const handleClearCacheAndResync = () => {
    if (window.confirm('Clear cached tokens and force a real-time sync with MongoDB Atlas?')) {
      adminClient.clearAdminCache();
      setSavedNotice('Admin cache purged. Synchronizing with MongoDB Atlas...');
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Admin Center Preferences & System Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Customize UI aesthetics, dark/light theme, API endpoints, and sandbox development states.
        </p>
      </div>

      {savedNotice ? (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <IconCheckCircle size={16} />
          {savedNotice}
        </div>
      ) : null}

      {/* Theme Customization Card */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <IconSun size={18} className="text-amber-500" />
            Appearance & Interface Theme
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Switch between dark mode (deep slate aesthetic) and light mode (crisp zinc).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-24 ${
              theme === 'dark'
                ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">🌙 Dark Theme</span>
              {theme === 'dark' ? <IconCheckCircle size={15} /> : null}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              High contrast deep slate for night work
            </span>
          </button>

          <button
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-24 ${
              theme === 'light'
                ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">☀️ Light Theme</span>
              {theme === 'light' ? <IconCheckCircle size={15} /> : null}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Crisp clean white and high clarity
            </span>
          </button>

          <button
            onClick={() => setTheme('system')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-24 ${
              theme === 'system'
                ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">💻 System Default</span>
              {theme === 'system' ? <IconCheckCircle size={15} /> : null}
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Syncs automatically with your OS preference ({actualTheme})
            </span>
          </button>
        </div>
      </div>

      {/* Backend & Security Token */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <IconKey size={18} className="text-blue-500" />
            Backend JWT Authentication Token
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Active admin token used to authenticate with NestJS endpoints at <code>/api/v1/admin/*</code>.
          </p>
        </div>

        <div className="space-y-3">
          <textarea
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            rows={3}
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-400">
              {adminClient.hasToken() ? (
                <span className="text-emerald-500 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Backend Connection Active
                </span>
              ) : (
                <span className="text-amber-500 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Dev Sandbox Mode (LocalStorage Persisted)
                </span>
              )}
            </span>

            <button
              onClick={handleSaveToken}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all"
            >
              Apply Security Token
            </button>
          </div>
        </div>
      </div>

      {/* Live Database Sync Card */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Purge Admin Cache & Force Live Database Resync
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Refreshes all active super admin credentials and re-queries live dynamic collections directly from MongoDB Atlas.
          </p>
        </div>

        <button
          onClick={handleClearCacheAndResync}
          className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
        >
          Resync with MongoDB Atlas
        </button>
      </div>
    </div>
  );
};
