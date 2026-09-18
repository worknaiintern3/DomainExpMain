import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';
import type { LoginMethodsStatus } from '@/api/types';
import { Button } from '@/components/common/Button';

import { LabeledInput } from './LoginPage';

type LoadState = 'error' | 'loading' | 'ready';

export const SecurityPage: React.FC = () => {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [methods, setMethods] = useState<LoginMethodsStatus | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [unlinkingGoogle, setUnlinkingGoogle] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const status = await auth.getLoginMethods();
      setMethods(status);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [auth]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const state = location.state as { googleConnected?: boolean } | null;
    if (state?.googleConnected) {
      setBanner('Google is now connected to your account.');
      // Clear the navigation state so a refresh/back doesn't re-show it.
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectGoogle = async () => {
    setActionError(null);
    setConnectingGoogle(true);
    try {
      // On success this navigates the whole page away to Google.
      await auth.startGoogleLink();
    } catch {
      setActionError('Could not start connecting Google. Please try again.');
      setConnectingGoogle(false);
    }
  };

  const disconnectGoogle = async () => {
    setActionError(null);
    setUnlinkingGoogle(true);
    try {
      const status = await auth.unlinkGoogle();
      setMethods(status);
      setBanner('Google has been disconnected.');
    } catch (error) {
      setActionError(
        error instanceof Error && error.message
          ? error.message
          : 'Could not disconnect Google. Please try again.',
      );
    } finally {
      setUnlinkingGoogle(false);
    }
  };

  if (loadState === 'loading') {
    return (
      <SecurityCard>
        <div className="flex items-center justify-center py-8">
          <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
        </div>
      </SecurityCard>
    );
  }

  if (loadState === 'error' || !methods) {
    return (
      <SecurityCard>
        <p className="text-body-sm text-error">We couldn't load your sign-in methods.</p>
        <Button variant="secondary" size="md" className="mt-unit-md" onClick={() => void refresh()}>
          Try again
        </Button>
      </SecurityCard>
    );
  }

  return (
    <SecurityCard>
      {banner && (
        <div className="mb-unit-md rounded-lg border border-primary/25 bg-primary/5 px-unit-base py-unit-sm text-body-sm text-on-surface" role="status">
          {banner}
        </div>
      )}
      {actionError && (
        <p role="alert" className="mb-unit-md text-body-sm text-error">{actionError}</p>
      )}

      <div className="flex flex-col gap-unit-md">
        <SignInMethodRow
          icon="password"
          title="Password"
          subtitle={methods.password.enabled ? 'Added' : 'Not added'}
        >
          {methods.password.enabled ? (
            <span className="text-label-md font-medium text-on-surface-variant">Added</span>
          ) : (
            <Button variant="primary" size="md" onClick={() => setShowAddPassword(true)}>
              Add password
            </Button>
          )}
        </SignInMethodRow>

        <SignInMethodRow
          icon="account_circle"
          title="Google"
          subtitle={
            methods.google.connected
              ? methods.google.email ?? 'Connected'
              : 'Not connected'
          }
        >
          {methods.google.connected ? (
            <Button
              variant="outline"
              size="md"
              disabled={!methods.canUnlinkGoogle || unlinkingGoogle}
              title={
                methods.canUnlinkGoogle
                  ? undefined
                  : 'Add a password before disconnecting Google, so you always have a way to sign in'
              }
              onClick={() => void disconnectGoogle()}
            >
              {unlinkingGoogle ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          ) : (
            <Button variant="primary" size="md" disabled={connectingGoogle} onClick={() => void connectGoogle()}>
              {connectingGoogle ? 'Redirecting…' : 'Connect Google'}
            </Button>
          )}
        </SignInMethodRow>

        {methods.google.connected && !methods.canUnlinkGoogle && (
          <p className="text-caption-xs text-secondary">
            Google is your only sign-in method right now, so it can't be disconnected. Add a password first.
          </p>
        )}
      </div>

      {showAddPassword && (
        <AddPasswordForm
          onCancel={() => setShowAddPassword(false)}
          onSuccess={(status) => {
            setMethods(status);
            setShowAddPassword(false);
            setBanner('Password added. You can now sign in with either Google or your email and password.');
          }}
        />
      )}
    </SecurityCard>
  );
};

const SecurityCard: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className="flex flex-col w-full max-w-2xl pb-unit-2xl">
    <h1 className="text-headline-md font-semibold text-on-surface">Security</h1>
    <p className="text-body-sm text-secondary mt-1 mb-unit-lg">
      Manage how you sign in to DomainPulse.
    </p>
    <section className="rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-sm p-unit-lg">
      {children}
    </section>
  </div>
);

const SignInMethodRow: React.FC<React.PropsWithChildren<{
  icon: string;
  subtitle: string;
  title: string;
}>> = ({ children, icon, subtitle, title }) => (
  <div className="flex items-center justify-between gap-unit-md rounded-lg border border-outline-variant/60 bg-surface-container-low px-unit-base py-unit-sm">
    <div className="flex items-center gap-unit-sm min-w-0">
      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-label-md font-semibold text-on-surface">{title}</span>
        <span className="text-caption-xs text-secondary truncate">{subtitle}</span>
      </div>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const MIN_PASSWORD_LENGTH = 12;

const AddPasswordForm: React.FC<{
  onCancel(): void;
  onSuccess(status: LoginMethodsStatus): void;
}> = ({ onCancel, onSuccess }) => {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const status = await auth.addPassword(password);
      onSuccess(status);
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : 'Could not add a password. Please try again.',
      );
    } finally {
      setSubmitting(false);
      setPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <form className="mt-unit-lg flex flex-col gap-unit-sm rounded-lg border border-outline-variant/60 p-unit-base" onSubmit={(event) => void submit(event)}>
      <h2 className="text-label-md font-semibold text-on-surface">Add a password</h2>
      <LabeledInput
        label="New password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
      />
      <LabeledInput
        label="Confirm password"
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
      />
      {formError && <p role="alert" className="text-body-sm text-error">{formError}</p>}
      <div className="flex gap-unit-sm mt-unit-2xs">
        <Button type="submit" variant="primary" size="md" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save password'}
        </Button>
        <Button type="button" variant="ghost" size="md" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
