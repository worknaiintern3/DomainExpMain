import React from 'react';
import { Navigate } from 'react-router-dom';

import { usePreferences } from './PreferencesContext';

/**
 * "/" opens the user's saved default landing page. While settings are still
 * loading it waits (briefly) instead of flashing the wrong page; if they fail
 * to load it falls back to the overview.
 */
export const LandingRedirect: React.FC = () => {
  const { general, status } = usePreferences();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-label="Loading">
        <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
      </div>
    );
  }

  return <Navigate to={status === 'ready' ? general.defaultLandingPage : '/overview'} replace />;
};
