/**
 * Standalone DomainPulse login screen (Phase 7B).
 *
 * Isolated from the approved AppShell UI. Matches the existing visual
 * language (background/surface tokens, primary brand mark, Button styles).
 * Shows only generic safe messages; tokens and secrets never surface here.
 */

import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api/client';
import { useAuth } from '../lib/auth/AuthContext';
import { Button } from '../components/common/Button';

interface LocationState {
  from?: string;
}

function toSafeLoginMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Invalid email or password.';
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export const LoginPage: React.FC = () => {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from ?? '/overview';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/overview" replace />;
  }

  // Never allow manual login while session bootstrap is still running:
  // submitting then could race the single-use refresh rotation.
  const isBootstrapping = status === 'loading';
  const isBusy = isBootstrapping || isSubmitting;
  const canSubmit =
    status === 'unauthenticated' &&
    email.trim().length > 0 &&
    password.length > 0 &&
    !isSubmitting;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (submitError) {
      setError(toSafeLoginMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex items-center justify-center px-unit-lg">
      <div className="w-full max-w-[400px] flex flex-col gap-unit-lg">
        <div className="flex items-center gap-unit-sm justify-center">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-micro">
            <span className="material-symbols-outlined text-[22px]">pulse_alert</span>
          </div>
          <span className="font-headline-sm text-headline-sm font-semibold tracking-tight">
            DomainPulse
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-unit-md rounded-xl bg-surface-container-lowest border border-outline-variant/60 shadow-micro p-unit-xl"
        >
          <div className="flex flex-col gap-unit-2xs">
            <span className="font-label-md text-label-md font-semibold">Sign in</span>
            <span className="font-body-sm text-body-sm text-secondary">
              Access your portfolio workspace.
            </span>
          </div>

          <label className="flex flex-col gap-unit-2xs">
            <span className="font-caption-xs text-caption-xs text-secondary font-medium">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              disabled={isBusy}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="h-10 w-full px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant shadow-micro placeholder:text-secondary focus:outline-none focus:border-primary/60 disabled:opacity-60"
            />
          </label>

          <label className="flex flex-col gap-unit-2xs">
            <span className="font-caption-xs text-caption-xs text-secondary font-medium">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              disabled={isBusy}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••••"
              className="h-10 w-full px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant shadow-micro placeholder:text-secondary focus:outline-none focus:border-primary/60 disabled:opacity-60"
            />
          </label>

          {error !== null && (
            <div
              role="alert"
              className="rounded-lg border border-error-container bg-error-container/40 text-on-error-container px-3 py-2 font-body-sm text-body-sm"
            >
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" disabled={!canSubmit}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>

          {status === 'loading' && (
            <span className="font-caption-xs text-caption-xs text-secondary text-center">
              Restoring session…
            </span>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
