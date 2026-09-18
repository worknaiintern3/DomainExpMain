import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/auth/AuthContext';
import { LoginPage } from '@/pages/LoginPage';

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

function renderLoginPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('LoginPage', () => {
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

  it('renders a "Sign in with Google" action that starts the Google login flow', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/auth/google/start') {
        return Promise.resolve({ authorizationUrl: 'https://accounts.google.com/mock-login' });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderLoginPage();
    fireEvent.click(screen.getByRole('button', { name: /sign in with google/iu }));

    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith('https://accounts.google.com/mock-login'));
    expect(sessionStorage.getItem('domainpulse.google-oauth-intent')).toBe('login');
  });

  it('password sign-in is unaffected by the presence of the Google button', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/auth/login') {
        return Promise.resolve({
          accessToken: 'access-token',
          accessTokenExpiresAt: new Date().toISOString(),
          refreshToken: 'refresh-token',
          session: { expiresAt: new Date().toISOString(), id: 'session-1' },
          user: {
            createdAt: new Date().toISOString(),
            displayName: 'Test User',
            email: 'user@example.test',
            id: 'user-1',
            updatedAt: new Date().toISOString(),
          },
        });
      }
      return Promise.reject(new Error(`unexpected call: ${path}`));
    });

    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-perfectly-fine-password' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/iu }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/auth/login', expect.objectContaining({
      body: { email: 'user@example.test', password: 'a-perfectly-fine-password' },
    })));
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
