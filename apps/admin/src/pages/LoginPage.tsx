import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { adminClient } from '../api/admin.client';
import { IconShield } from '../components/Icons';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // If already authenticated, redirect to destination or platform overview
  React.useEffect(() => {
    if (adminClient.hasToken()) {
      const state = location.state as { from?: string | { pathname: string; search?: string } } | null;
      const destination = typeof state?.from === 'string'
        ? state.from
        : state?.from
          ? `${state.from.pathname}${state.from.search || ''}`
          : '/';
      navigate(destination, { replace: true });
    }
  }, [navigate, location]);

  const redirectAfterLogin = () => {
    const state = location.state as { from?: string | { pathname: string; search?: string } } | null;
    const destination = typeof state?.from === 'string'
      ? state.from
      : state?.from
        ? `${state.from.pathname}${state.from.search || ''}`
        : '/';
    navigate(destination, { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      await adminClient.login(email.trim(), password);
      redirectAfterLogin();
    } catch (err: any) {
      setAuthError(err?.message || 'Authentication failed. Please verify administrator credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl space-y-6 animate-fadeIn">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center font-black text-blue-600 dark:text-cyan-400">
              DP
            </div>
          </div>
          <h1 id="admin-sign-in-heading" className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <IconShield size={22} className="text-blue-500" />
            Sign in to Admin Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in with your administrator account to access platform metrics, domain inventory, and user management.
          </p>
        </div>

        {authError ? (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs">
            {authError}
          </div>
        ) : null}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Admin Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="v@gmail.com"
              required
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
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
              required
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all disabled:opacity-50 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Sign In with Backend'}
          </button>
        </form>
      </div>
    </div>
  );
};
