import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const ProtectedRoute: React.FC = () => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div
        className="min-h-screen bg-background text-on-surface flex items-center justify-center"
        role="status"
        aria-label="Loading session"
      >
        <div className="flex flex-col items-center gap-unit-sm">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-micro">
            <span className="material-symbols-outlined text-[22px]">pulse_alert</span>
          </div>
          <span className="font-label-md text-label-md text-secondary">Restoring session…</span>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};
