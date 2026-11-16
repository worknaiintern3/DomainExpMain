import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { adminClient, ADMIN_SESSION_CHANGED_EVENT } from '../api/admin.client';

interface Props {
  children?: React.ReactNode;
}

export const AdminProtectedRoute: React.FC<Props> = ({ children }) => {
  const location = useLocation();
  const [hasToken, setHasToken] = useState(() => adminClient.hasToken());

  useEffect(() => {
    const updateSession = () => setHasToken(adminClient.hasToken());
    window.addEventListener(ADMIN_SESSION_CHANGED_EVENT, updateSession);
    window.addEventListener('storage', updateSession);
    return () => {
      window.removeEventListener(ADMIN_SESSION_CHANGED_EVENT, updateSession);
      window.removeEventListener('storage', updateSession);
    };
  }, []);

  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children ? <>{children}</> : <Outlet />;
};

