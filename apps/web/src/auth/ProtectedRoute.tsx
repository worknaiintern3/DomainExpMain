import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext';

/**
 * Optional marketing-site origin (apps/landing). When set, a signed-out
 * visitor opening "/" is sent there instead of the login form. Deep links
 * such as /domains still go to /login.
 */
function readLandingUrl(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return (env?.['VITE_LANDING_URL'] ?? '').trim();
  } catch {
    return '';
  }
}

export const ProtectedRoute: React.FC = () => {
  const auth = useAuth();
  const location = useLocation();
  const landingUrl = readLandingUrl();
  const sendToLanding =
    auth.status !== 'booting' &&
    auth.status !== 'authenticated' &&
    location.pathname === '/' &&
    landingUrl !== '';

  React.useEffect(() => {
    if (sendToLanding) window.location.replace(landingUrl);
  }, [sendToLanding, landingUrl]);

  if (sendToLanding) return null;

  if (auth.status === 'booting') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest px-6 py-5 shadow-sm text-center">
          <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
          <p className="mt-2 text-body-sm text-secondary">Restoring your secure session…</p>
        </div>
      </div>
    );
  }

  if (auth.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export const GuestRoute: React.FC = () => {
  const auth = useAuth();
  if (auth.status === 'booting') return null;
  return auth.status === 'authenticated' ? <Navigate to="/overview" replace /> : <Outlet />;
};
