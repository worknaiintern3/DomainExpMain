import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext';

export const ProtectedRoute: React.FC = () => {
  const auth = useAuth();
  const location = useLocation();

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
