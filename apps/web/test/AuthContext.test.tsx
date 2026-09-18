import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '@/auth/AuthContext';

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
const loginResponse = {
  accessToken: 'access-token',
  accessTokenExpiresAt: now,
  refreshToken: 'refresh-token',
  session: { expiresAt: now, id: 'session-1' },
  user: publicUser,
};

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="error">{auth.error ?? ''}</span>
      <button onClick={() => auth.startGoogleLogin().catch(() => {})}>start-login</button>
      <button onClick={() => auth.completeGoogleLogin('code-1', 'state-1').catch(() => {})}>complete-login</button>
      <button onClick={() => auth.startGoogleLink().catch(() => {})}>start-link</button>
      <button onClick={() => auth.completeGoogleLink('code-1', 'link-state-1').catch(() => {})}>complete-link</button>
      <button onClick={() => auth.getLoginMethods().catch(() => {})}>get-login-methods</button>
      <button onClick={() => auth.addPassword('a-new-password').catch(() => {})}>add-password</button>
      <button onClick={() => auth.unlinkGoogle().catch(() => {})}>unlink-google</button>
    </div>
  );
}

describe('AuthContext Google OAuth methods', () => {
  let assignSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiRequest.mockReset();
    sessionStorage.clear();
    assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: assignSpy },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('startGoogleLogin sets the login intent marker, requests the authorization URL, and navigates the top-level window', async () => {
    apiRequest.mockResolvedValueOnce({ authorizationUrl: 'https://accounts.google.com/mock-login' });
    render(<AuthProvider><Probe /></AuthProvider>);

    fireEvent.click(screen.getByText('start-login'));

    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('https://accounts.google.com/mock-login'));
    expect(sessionStorage.getItem('domainpulse.google-oauth-intent')).toBe('login');
    expect(apiRequest).toHaveBeenCalledWith('/auth/google/start', expect.objectContaining({
      authenticated: false,
      method: 'POST',
    }));
  });

  it('startGoogleLink sets the link intent marker and calls the authenticated link/start endpoint', async () => {
    apiRequest.mockResolvedValueOnce({ authorizationUrl: 'https://accounts.google.com/mock-link' });
    render(<AuthProvider><Probe /></AuthProvider>);

    fireEvent.click(screen.getByText('start-link'));

    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('https://accounts.google.com/mock-link'));
    expect(sessionStorage.getItem('domainpulse.google-oauth-intent')).toBe('link');
    expect(apiRequest).toHaveBeenCalledWith('/auth/google/link/start', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('completeGoogleLogin applies the returned session and clears any prior error', async () => {
    apiRequest.mockResolvedValueOnce(loginResponse);
    render(<AuthProvider><Probe /></AuthProvider>);

    fireEvent.click(screen.getByText('complete-login'));

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(apiRequest).toHaveBeenCalledWith('/auth/google/callback', expect.objectContaining({
      authenticated: false,
      body: { code: 'code-1', state: 'state-1' },
      method: 'POST',
    }));
  });

  it('completeGoogleLogin surfaces the same-email conflict message on failure', async () => {
    const { ApiError } = await import('@/api/client');
    apiRequest.mockRejectedValueOnce(
      new ApiError({
        detail: 'An account with this email already exists. Sign in with your password, then connect Google from Security settings.',
        status: 409,
        title: 'Conflict',
      }),
    );
    render(<AuthProvider><Probe /></AuthProvider>);

    fireEvent.click(screen.getByText('complete-login'));

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    expect(screen.getByTestId('error').textContent).toBe(
      'An account with this email already exists. Sign in with your password, then connect Google from Security settings.',
    );
  });

  it('completeGoogleLink calls the authenticated link/callback endpoint and does not touch session state', async () => {
    apiRequest.mockResolvedValueOnce({ alreadyLinked: false, providerEmail: 'linked@example.test' });
    render(<AuthProvider><Probe /></AuthProvider>);

    fireEvent.click(screen.getByText('complete-link'));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/auth/google/link/callback', expect.objectContaining({
      body: { code: 'code-1', state: 'link-state-1' },
      method: 'POST',
    })));
    // Unlike login/callback, link/callback never changes auth status.
    expect(screen.getByTestId('status').textContent).not.toBe('authenticated');
  });

  it('getLoginMethods, addPassword, and unlinkGoogle call their authenticated endpoints', async () => {
    apiRequest.mockResolvedValue({
      canUnlinkGoogle: true,
      google: { connected: true, email: 'user@example.test' },
      password: { enabled: true },
    });
    render(<AuthProvider><Probe /></AuthProvider>);

    fireEvent.click(screen.getByText('get-login-methods'));
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith('/auth/login-methods'));

    fireEvent.click(screen.getByText('add-password'));
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith('/auth/password/add', expect.objectContaining({
      body: { password: 'a-new-password' },
      method: 'POST',
    })));

    fireEvent.click(screen.getByText('unlink-google'));
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith('/auth/google/link', expect.objectContaining({
      method: 'DELETE',
    })));
  });

  it('password login is unaffected by the presence of the Google OAuth methods', async () => {
    apiRequest.mockResolvedValueOnce(loginResponse);

    function LoginProbe() {
      const auth = useAuth();
      return (
        <button onClick={() => auth.login({ email: 'user@example.test', password: 'a-perfectly-fine-password' }).catch(() => {})}>
          login
        </button>
      );
    }

    render(<AuthProvider><LoginProbe /></AuthProvider>);
    fireEvent.click(screen.getByText('login'));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/auth/login', expect.objectContaining({
      authenticated: false,
      body: { email: 'user@example.test', password: 'a-perfectly-fine-password' },
      method: 'POST',
    })));
  });
});
