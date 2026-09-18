import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/auth/AuthContext';
import { GoogleCallbackPage } from '@/pages/GoogleCallbackPage';

const { apiRequest } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/api/client')>('@/api/client');
  return {
    ...actual,
    apiRequest,
  };
});

const now = new Date('2033-05-18T03:33:20.000Z').toISOString();
const publicUser = {
  createdAt: now,
  displayName: 'Test User',
  email: 'user@example.test',
  id: 'user-1',
  updatedAt: now,
};

function setUrl(search: string): void {
  window.history.pushState(null, '', `/auth/google/callback${search}`);
}

function renderCallbackPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[`${window.location.pathname}${window.location.search}`]}>
        <Routes>
          <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
          <Route path="/overview" element={<div>overview-page</div>} />
          <Route path="/security" element={<div>security-page</div>} />
          <Route path="/login" element={<div>login-page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

/** A restorable session -- present so AuthProvider's boot effect attempts `/auth/refresh` + `/auth/me` rather than settling immediately as unauthenticated. */
function seedRestorableSession(): void {
  sessionStorage.setItem('domainpulse.refresh-token', 'a-stored-refresh-token');
}

describe('GoogleCallbackPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiRequest.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('scrubs code/state from the visible URL immediately, before any async work', () => {
    setUrl('?code=raw-code&state=raw-state');
    apiRequest.mockReturnValue(new Promise(() => {}));

    renderCallbackPage();

    expect(window.location.search).toBe('');
  });

  it('LOGIN intent: completes login and navigates to /overview on success', async () => {
    sessionStorage.setItem('domainpulse.google-oauth-intent', 'login');
    setUrl('?code=valid-code&state=valid-state');
    apiRequest.mockImplementation((path: string) => {
      if (path === '/auth/google/callback') {
        return Promise.resolve({
          accessToken: 'access-token',
          accessTokenExpiresAt: now,
          refreshToken: 'refresh-token',
          session: { expiresAt: now, id: 'session-1' },
          user: publicUser,
        });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderCallbackPage();

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/auth/google/callback', expect.objectContaining({
      body: { code: 'valid-code', state: 'valid-state' },
    })));
    await waitFor(() => expect(screen.getByText('overview-page')).toBeInTheDocument());
  });

  it('LOGIN intent: shows a failure state when the backend rejects the callback', async () => {
    sessionStorage.setItem('domainpulse.google-oauth-intent', 'login');
    setUrl('?code=invalid-code&state=invalid-state');
    apiRequest.mockRejectedValue(new Error('Authentication failed'));

    renderCallbackPage();

    await waitFor(() => expect(screen.getByText(/sign-in failed/iu)).toBeInTheDocument());
  });

  it('shows a cancelled state and never calls the backend when Google reports an error', async () => {
    setUrl('?error=access_denied');

    renderCallbackPage();

    await waitFor(() => expect(screen.getByText(/sign-in cancelled/iu)).toBeInTheDocument());
    expect(apiRequest).not.toHaveBeenCalledWith('/auth/google/callback', expect.anything());
    expect(apiRequest).not.toHaveBeenCalledWith('/auth/google/link/callback', expect.anything());
  });

  it('shows a failure state when code/state are missing entirely', async () => {
    setUrl('');

    renderCallbackPage();

    await waitFor(() => expect(screen.getByText(/sign-in failed/iu)).toBeInTheDocument());
    expect(apiRequest).not.toHaveBeenCalledWith('/auth/google/callback', expect.anything());
  });

  it('P2-1 regression: valid-looking code+state but NO intent marker fails closed instead of spinning forever', async () => {
    // Deliberately no sessionStorage.setItem('domainpulse.google-oauth-intent', ...) --
    // simulates a stray/bookmarked visit that never went through startGoogleLogin/startGoogleLink.
    setUrl('?code=looks-valid-code&state=looks-valid-state');

    renderCallbackPage();

    await waitFor(() => expect(screen.getByText(/sign-in failed/iu)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /back to sign in/iu })).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalledWith('/auth/google/callback', expect.anything());
    expect(apiRequest).not.toHaveBeenCalledWith('/auth/google/link/callback', expect.anything());
    // The URL must still be scrubbed exactly as the existing behavior requires.
    expect(window.location.search).toBe('');
  });

  it('P2-1 regression: an unknown/corrupt intent marker value also fails closed', async () => {
    sessionStorage.setItem('domainpulse.google-oauth-intent', 'some-corrupted-value');
    setUrl('?code=looks-valid-code&state=looks-valid-state');

    renderCallbackPage();

    await waitFor(() => expect(screen.getByText(/sign-in failed/iu)).toBeInTheDocument());
    expect(apiRequest).not.toHaveBeenCalledWith('/auth/google/callback', expect.anything());
    expect(apiRequest).not.toHaveBeenCalledWith('/auth/google/link/callback', expect.anything());
  });

  it('LINK intent: waits for the existing session to restore, then completes the link and navigates to /security', async () => {
    sessionStorage.setItem('domainpulse.google-oauth-intent', 'link');
    seedRestorableSession();
    setUrl('?code=valid-code&state=link-state');
    apiRequest.mockImplementation((path: string) => {
      if (path === '/auth/refresh') {
        return Promise.resolve({
          accessToken: 'restored-access-token',
          accessTokenExpiresAt: now,
          refreshToken: 'restored-refresh-token',
          session: { expiresAt: now, id: 'session-1' },
        });
      }
      if (path === '/auth/me') {
        return Promise.resolve({ user: publicUser });
      }
      if (path === '/auth/google/link/callback') {
        return Promise.resolve({ alreadyLinked: false, providerEmail: 'linked@example.test' });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderCallbackPage();

    // Restoration must complete before the link callback is attempted.
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/auth/me', expect.anything()));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/auth/google/link/callback', expect.objectContaining({
      body: { code: 'valid-code', state: 'link-state' },
    })));
    await waitFor(() => expect(screen.getByText('security-page')).toBeInTheDocument());
    expect(apiRequest).not.toHaveBeenCalledWith('/auth/google/callback', expect.anything());
  });

  it('LINK intent: shows a session-expired message and never attempts the link if the session cannot be restored', async () => {
    sessionStorage.setItem('domainpulse.google-oauth-intent', 'link');
    seedRestorableSession();
    setUrl('?code=valid-code&state=link-state');
    apiRequest.mockImplementation((path: string) => {
      if (path === '/auth/refresh') {
        return Promise.reject(new Error('refresh token invalid'));
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderCallbackPage();

    await waitFor(() => expect(screen.getByText(/sign in again/iu)).toBeInTheDocument());
    expect(apiRequest).not.toHaveBeenCalledWith('/auth/google/link/callback', expect.anything());
  });

  it('LINK intent: a failed link callback shows the generic failure state, not a fabricated success', async () => {
    sessionStorage.setItem('domainpulse.google-oauth-intent', 'link');
    seedRestorableSession();
    setUrl('?code=valid-code&state=link-state');
    apiRequest.mockImplementation((path: string) => {
      if (path === '/auth/refresh') {
        return Promise.resolve({
          accessToken: 'restored-access-token',
          accessTokenExpiresAt: now,
          refreshToken: 'restored-refresh-token',
          session: { expiresAt: now, id: 'session-1' },
        });
      }
      if (path === '/auth/me') {
        return Promise.resolve({ user: publicUser });
      }
      if (path === '/auth/google/link/callback') {
        return Promise.reject(new Error('Authentication failed'));
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderCallbackPage();

    await waitFor(() => expect(screen.getByText(/sign-in failed/iu)).toBeInTheDocument());
  });
});
