import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { mobileAdminClient } from '../api/mobile-admin.client';

interface Props {
  children: React.ReactNode;
}

const NAV_LINKS = [
  { path: '/', label: 'Overview', icon: '📊' },
  { path: '/appearance', label: 'Appearance & Theme', icon: '🎨' },
  { path: '/features', label: 'Feature Flags', icon: '🚩' },
  { path: '/home-layout', label: 'Home Screen Layout', icon: '🧩' },
  { path: '/navigation', label: 'Navigation Tabs', icon: '📑' },
  { path: '/announcements', label: 'Announcements', icon: '📢' },
  { path: '/versions', label: 'App Versions', icon: '📱' },
  { path: '/audit-logs', label: 'Audit Trail', icon: '📜' },
];

export const AdminLayout: React.FC<Props> = ({ children }) => {
  const location = useLocation();
  const [hasToken, setHasToken] = useState(mobileAdminClient.hasToken());
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      await mobileAdminClient.login(email.trim(), password);
      setHasToken(true);
      setShowModal(false);
      window.location.reload();
    } catch (err: any) {
      setAuthError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToken = () => {
    if (!manualToken.trim()) return;
    mobileAdminClient.setToken(manualToken.trim());
    setHasToken(true);
    setShowModal(false);
    window.location.reload();
  };

  const handleSignOut = () => {
    mobileAdminClient.clearToken();
    setHasToken(false);
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 p-4 flex flex-col justify-between backdrop-blur-md">
        <div>
          {/* Logo / Header */}
          <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-slate-800">
            <img
              src="/logo.png"
              alt="DomainPulse"
              className="w-9 h-9 rounded-xl shadow-lg shadow-cyan-500/20 object-cover border border-cyan-500/30"
            />
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                DomainPulse
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Admin
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Mobile Control Center</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Mobile Management
            </div>
            {NAV_LINKS.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="text-base">{link.icon}</span>
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-800 px-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Mode:</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-full border text-[11px] ${
                hasToken
                  ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30'
                  : 'text-amber-400 bg-amber-950/60 border-amber-500/30'
              }`}
            >
              {hasToken ? 'LIVE_BACKEND' : 'DEV_SANDBOX'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Core API:</span>
            <span className="text-slate-400">/api/v1/admin/mobile</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/40 px-8 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                hasToken ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-xs font-semibold text-slate-300">
              {hasToken
                ? 'Live Remote Config Active (Authenticated)'
                : 'Local Dev Sandbox Active (Changes Persist Locally)'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowModal(true)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                hasToken
                  ? 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'bg-blue-600/20 border-blue-500/40 text-blue-400 hover:bg-blue-600/30'
              }`}
            >
              {hasToken ? 'Manage Auth Token' : '🔑 Sign In / Set Token'}
            </button>

            {hasToken ? (
              <button
                onClick={handleSignOut}
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
              >
                Sign Out
              </button>
            ) : null}

            <div className="h-4 w-px bg-slate-800" />
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <span>🌐 Open Web App</span>
            </a>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Auth Modal */}
      {showModal ? (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>🔐</span> Admin Authentication
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            {authError ? (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs">
                {authError}
              </div>
            ) : null}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Admin Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@domainpulse.dev"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In with Backend'}
              </button>
            </form>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800" />
              <span className="flex-shrink mx-3 text-slate-400 text-xs font-semibold">
                OR PASTE JWT TOKEN
              </span>
              <div className="flex-grow border-t border-slate-800" />
            </div>

            <div className="space-y-2">
              <textarea
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleApplyToken}
                className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Set Custom Token
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Continue in Local Dev Sandbox
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
