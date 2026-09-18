import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/auth/AuthContext';
import { SecurityPage } from '@/pages/SecurityPage';

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

function renderSecurityPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/security']}>
        <SecurityPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('SecurityPage', () => {
  let assignSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    apiRequest.mockReset();
    assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign: assignSpy },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('password-only user: shows Connect Google, and disconnect is not offered', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/auth/login-methods') {
        return Promise.resolve({
          canUnlinkGoogle: false,
          google: { connected: false, email: null },
          password: { enabled: true },
        });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderSecurityPage();

    await waitFor(() => expect(screen.getAllByText('Added').length).toBeGreaterThan(0));
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect google/iu })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /disconnect/iu })).not.toBeInTheDocument();
  });

  it('Google-only user: shows Add Password, and disconnect is disabled (last login method)', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/auth/login-methods') {
        return Promise.resolve({
          canUnlinkGoogle: false,
          google: { connected: true, email: 'google-only@example.test' },
          password: { enabled: false },
        });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderSecurityPage();

    await waitFor(() => expect(screen.getByText('google-only@example.test')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /add password/iu })).toBeInTheDocument();
    const disconnectButton = screen.getByRole('button', { name: /disconnect/iu });
    expect(disconnectButton).toBeDisabled();
  });

  it('password + Google user: disconnect succeeds and refreshes the status', async () => {
    let unlinked = false;
    apiRequest.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === '/auth/login-methods') {
        return Promise.resolve({
          canUnlinkGoogle: !unlinked ? true : false,
          google: unlinked ? { connected: false, email: null } : { connected: true, email: 'both@example.test' },
          password: { enabled: true },
        });
      }
      if (path === '/auth/google/link' && options?.method === 'DELETE') {
        unlinked = true;
        return Promise.resolve({
          canUnlinkGoogle: false,
          google: { connected: false, email: null },
          password: { enabled: true },
        });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderSecurityPage();

    await waitFor(() => expect(screen.getByText('both@example.test')).toBeInTheDocument());
    const disconnectButton = screen.getByRole('button', { name: /disconnect/iu });
    expect(disconnectButton).not.toBeDisabled();
    fireEvent.click(disconnectButton);

    await waitFor(() => expect(screen.getByText('Not connected')).toBeInTheDocument());
    expect(apiRequest).toHaveBeenCalledWith('/auth/google/link', expect.objectContaining({ method: 'DELETE' }));
  });

  it('Connect Google starts the authenticated link flow', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/auth/login-methods') {
        return Promise.resolve({
          canUnlinkGoogle: false,
          google: { connected: false, email: null },
          password: { enabled: true },
        });
      }
      if (path === '/auth/google/link/start') {
        return Promise.resolve({ authorizationUrl: 'https://accounts.google.com/mock-link' });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderSecurityPage();

    await waitFor(() => expect(screen.getByRole('button', { name: /connect google/iu })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /connect google/iu }));

    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('https://accounts.google.com/mock-link'));
    expect(sessionStorage.getItem('domainpulse.google-oauth-intent')).toBe('link');
  });

  it('Add Password: validates confirmation match and length client-side, then submits and refreshes status', async () => {
    let passwordAdded = false;
    apiRequest.mockImplementation((path: string, options?: { body?: unknown }) => {
      if (path === '/auth/login-methods') {
        return Promise.resolve({
          canUnlinkGoogle: false,
          google: { connected: true, email: 'google-only@example.test' },
          password: { enabled: passwordAdded },
        });
      }
      if (path === '/auth/password/add') {
        passwordAdded = true;
        return Promise.resolve({
          canUnlinkGoogle: true,
          google: { connected: true, email: 'google-only@example.test' },
          password: { enabled: true },
        });
      }
      return Promise.reject(new Error(`unexpected call: ${JSON.stringify({ path, options })}`));
    });

    renderSecurityPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /add password/iu })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add password/iu }));

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /save password/iu }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 12 characters/iu);
    expect(apiRequest).not.toHaveBeenCalledWith('/auth/password/add', expect.anything());

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'a-brand-new-password' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'does-not-match' } });
    fireEvent.click(screen.getByRole('button', { name: /save password/iu }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/iu);

    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'a-brand-new-password' } });
    fireEvent.click(screen.getByRole('button', { name: /save password/iu }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/auth/password/add', expect.objectContaining({
      body: { password: 'a-brand-new-password' },
      method: 'POST',
    })));
    await waitFor(() => expect(screen.getByText(/password added/iu)).toBeInTheDocument());
  });
});
