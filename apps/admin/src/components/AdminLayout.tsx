import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { adminClient } from '../api/admin.client';
import { useTheme } from '../context/ThemeContext';
import {
  IconActivity,
  IconApple,
  IconFlag,
  IconGitBranch,
  IconGlobe,
  IconHistory,
  IconKey,
  IconLayout,
  IconMegaphone,
  IconMoon,
  IconNavigation,
  IconPalette,
  IconSearch,
  IconServer,
  IconSettings,
  IconShield,
  IconSmartphone,
  IconSun,
  IconUsers,
} from './Icons';

interface Props {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<Props> = ({ children }) => {
  const location = useLocation();
  const { toggleTheme, actualTheme } = useTheme();

  const [hasToken, setHasToken] = useState(adminClient.hasToken());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Global search modal (Ctrl+K)
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Handle Ctrl+K shortcut
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      await adminClient.login(email.trim(), password);
      setHasToken(true);
      setShowAuthModal(false);
      window.location.reload();
    } catch (err: any) {
      setAuthError(err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToken = () => {
    if (!manualToken.trim()) return;
    adminClient.setToken(manualToken.trim());
    setHasToken(true);
    setShowAuthModal(false);
    window.location.reload();
  };

  const handleSignOut = () => {
    adminClient.clearToken();
    setHasToken(false);
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-4 flex flex-col justify-between backdrop-blur-md sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-6">
          {/* Logo & Platform Badge */}
          <div className="flex items-center gap-3 px-2 py-2 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-blue-500/20 flex-shrink-0">
              <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center font-black text-sm text-blue-600 dark:text-cyan-400">
                DP
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
                  DomainPulse
                </span>
                <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-blue-600 text-white">
                  Admin
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Web & Mobile Center
              </p>
            </div>
          </div>

          {/* SECTION: COMMAND CENTER */}
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Command Center
            </div>

            <Link
              to="/"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <IconActivity size={16} />
              <span>Platform Overview</span>
            </Link>

            <Link
              to="/users?tab=all"
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/users' && (!location.search || location.search.includes('tab=all'))
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <IconUsers size={16} />
                <span>All Users Hub</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                location.pathname === '/users' && (!location.search || location.search.includes('tab=all'))
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                All
              </span>
            </Link>
          </div>

          {/* SECTION: WEBSITE PLATFORM */}
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Website Platform</span>
              <IconGlobe size={12} className="text-blue-500" />
            </div>

            <Link
              to="/users?tab=web"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/users' && location.search.includes('tab=web')
                  ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <IconGlobe size={16} className="text-blue-500" />
              <span>Website Users</span>
            </Link>

            <Link
              to="/domains"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/domains'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <IconShield size={16} />
              <span>All Domains & SSL</span>
            </Link>

            <Link
              to="/servers"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/servers'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <IconServer size={16} />
              <span>Infrastructure Nodes</span>
            </Link>
          </div>

          {/* SECTION: MOBILE APPLICATION */}
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Mobile Application</span>
              <IconSmartphone size={12} className="text-indigo-500" />
            </div>

            <Link
              to="/users?tab=mobile"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/users' && location.search.includes('tab=mobile')
                  ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <IconSmartphone size={16} className="text-indigo-500" />
              <span>Mobile Users</span>
            </Link>

            <Link
              to="/mobile-fleet"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/mobile-fleet'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <IconApple size={16} />
              <span>Device Fleet & Push</span>
            </Link>

            <Link
              to="/appearance"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/appearance'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <IconPalette size={16} />
              <span>Branding & Theme</span>
            </Link>

            <Link
              to="/features"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/features'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <IconFlag size={16} />
              <span>Feature Flags</span>
            </Link>

            <Link
              to="/home-layout"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/home-layout'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <IconLayout size={16} />
              <span>Home Screen Layout</span>
            </Link>

            <Link
              to="/navigation"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/navigation'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <IconNavigation size={16} />
              <span>Navigation Tabs</span>
            </Link>

            <Link
              to="/announcements"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/announcements'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <IconMegaphone size={16} />
              <span>Announcements</span>
            </Link>

            <Link
              to="/versions"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/versions'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <IconGitBranch size={16} />
              <span>App Versions & Updates</span>
            </Link>
          </div>

          {/* SECTION: SYSTEM & AUDIT */}
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              System & Operations
            </div>

            <Link
              to="/audit-logs"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/audit-logs'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <IconHistory size={16} />
              <span>Audit Logs</span>
            </Link>

            <Link
              to="/settings"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                location.pathname === '/settings'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <IconSettings size={16} />
              <span>Preferences & API</span>
            </Link>
          </div>
        </div>

        {/* FOOTER CONNECTION STATUS */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 px-2 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Database Engine:</span>
            <span className="font-bold px-2 py-0.5 rounded-full text-[10px] border text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              MONGODB ATLAS
            </span>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* HEADER BAR */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 px-8 flex items-center justify-between backdrop-blur-md sticky top-0 z-40">
          {/* Quick Search Trigger */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/60 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-all w-64 justify-between"
          >
            <div className="flex items-center gap-2">
              <IconSearch size={14} />
              <span>Quick Search...</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono">
              Ctrl+K
            </kbd>
          </button>

          {/* Right Action Icons */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all"
              title={`Switch Theme (currently ${actualTheme})`}
            >
              {actualTheme === 'dark' ? <IconSun size={18} className="text-amber-400" /> : <IconMoon size={18} className="text-blue-600" />}
            </button>

            {/* Auth / Manage Token Button */}
            <button
              onClick={() => setShowAuthModal(true)}
              className={`text-xs px-3.5 py-1.5 rounded-xl border font-semibold transition-all flex items-center gap-1.5 ${
                hasToken
                  ? 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
                  : 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm shadow-blue-500/20'
              }`}
            >
              <IconKey size={13} />
              <span>{hasToken ? 'Super Admin (Connected)' : '🔑 Sign In / Live Token'}</span>
            </button>

            {hasToken ? (
              <button
                onClick={handleSignOut}
                className="text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-semibold transition-colors"
              >
                Sign Out
              </button>
            ) : null}

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

            {/* Web App Link */}
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 transition-colors font-medium"
            >
              <IconGlobe size={14} />
              <span>Open Web App</span>
            </a>
          </div>
        </header>

        {/* MAIN BODY */}
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* AUTH MODAL */}
      {showAuthModal ? (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <IconShield size={18} className="text-blue-500" />
                Admin Authentication & Live Backend Link
              </h2>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {authError ? (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
                {authError}
              </div>
            ) : null}

            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Admin Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="v@gmail.com"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all disabled:opacity-50"
                >
                  {loading ? 'Authenticating...' : 'Sign In with Backend'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@domainpulse.com');
                    setPassword('Admin@123');
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700"
                >
                  Autofill Super Admin
                </button>
              </div>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              <span className="flex-shrink mx-3 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                OR PASTE JWT TOKEN
              </span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            </div>

            <div className="space-y-2">
              <textarea
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                rows={2}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleApplyToken}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold"
              >
                Set Custom Token
              </button>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
              >
                Stay in Local Dev Sandbox
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* QUICK COMMAND PALETTE MODAL (Ctrl+K) */}
      {showSearchModal ? (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <IconSearch size={18} className="text-blue-500" />
              <input
                type="text"
                autoFocus
                placeholder="Search across Website users, Mobile fleet, Feature flags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              <button onClick={() => setShowSearchModal(false)} className="text-slate-400 hover:text-white text-xs">
                ESC
              </button>
            </div>

            <div className="p-3 max-h-80 overflow-y-auto space-y-1 text-xs">
              <Link
                to="/users?tab=web"
                onClick={() => setShowSearchModal(false)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <IconGlobe size={16} className="text-blue-500" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Website Users Tab</div>
                  <div className="text-[11px] text-slate-500">View domains, monitored servers, web sessions</div>
                </div>
              </Link>

              <Link
                to="/users?tab=mobile"
                onClick={() => setShowSearchModal(false)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <IconSmartphone size={16} className="text-indigo-500" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Mobile Users Tab</div>
                  <div className="text-[11px] text-slate-500">View registered devices, push tokens, mobile sessions</div>
                </div>
              </Link>

              <Link
                to="/mobile-fleet"
                onClick={() => setShowSearchModal(false)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <IconApple size={16} className="text-slate-700 dark:text-slate-300" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Mobile Fleet & Broadcast</div>
                  <div className="text-[11px] text-slate-500">Inspect iOS and Android device fleet & push campaigns</div>
                </div>
              </Link>

              <Link
                to="/features"
                onClick={() => setShowSearchModal(false)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <IconFlag size={16} className="text-emerald-500" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Mobile Feature Flags</div>
                  <div className="text-[11px] text-slate-500">Enable/disable mobile capabilities & min version</div>
                </div>
              </Link>

              <Link
                to="/domains"
                onClick={() => setShowSearchModal(false)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <IconShield size={16} className="text-cyan-500" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">All Monitored Domains</div>
                  <div className="text-[11px] text-slate-500">Global DNS, WHOIS, and SSL expiry health</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
