/**
 * Google Play Console connection page.
 *
 * Connects a Google account through the backend's existing OAuth start
 * endpoint, verifies the Play developer account, and lists the apps that
 * account publishes. The backend is deployed and unchanged; this page only
 * consumes `/api/v1/google-play/*`.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  disconnectGooglePlay,
  getGooglePlayApps,
  getGooglePlayStatus,
  refreshGooglePlayToken,
  startGooglePlayAuth,
  verifyGooglePlayDeveloperAccount,
  type GooglePlayApp,
  type GooglePlayStatusResponse,
} from '@/api/google-play';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/auth/AuthContext';
import { syncGooglePlayApps } from '@/features/google-play/sync-apps';

type StatusState = 'loading' | 'ready' | 'error';
type AppsState = 'idle' | 'loading' | 'success' | 'error';
type PendingAction = 'connect' | 'verify' | 'refresh' | 'disconnect' | 'sync' | null;

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.detail || error.title || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function StatusPill({ connected }: { connected: boolean }): React.ReactElement {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
        connected
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-outline-variant/60 bg-surface-container text-secondary'
      }`}
    >
      <span className="material-symbols-outlined text-[13px]">
        {connected ? 'check_circle' : 'link_off'}
      </span>
      {connected ? 'Connected' : 'Not connected'}
    </span>
  );
}

export const GooglePlayPage: React.FC = () => {
  const { user } = useAuth();

  const [connection, setConnection] = useState<GooglePlayStatusResponse | null>(null);
  const [statusState, setStatusState] = useState<StatusState>('loading');
  const [statusError, setStatusError] = useState<string | null>(null);

  const [apps, setApps] = useState<GooglePlayApp[]>([]);
  const [appsState, setAppsState] = useState<AppsState>('idle');
  const [appsError, setAppsError] = useState<string | null>(null);

  const [developerAccountInput, setDeveloperAccountInput] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const generationRef = useRef(0);
  const awaitingOAuthRef = useRef(false);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    setStatusState('loading');
    setStatusError(null);

    try {
      const nextStatus = await getGooglePlayStatus();
      if (generation !== generationRef.current) return;

      setConnection(nextStatus);
      setStatusState('ready');

      const developerAccountId = nextStatus.developerAccount?.id;
      if (!nextStatus.connected || !developerAccountId) {
        setApps([]);
        setAppsState('idle');
        setAppsError(null);
        return;
      }

      setAppsState('loading');
      setAppsError(null);
      try {
        const response = await getGooglePlayApps();
        if (generation !== generationRef.current) return;
        setApps(response.apps);
        setAppsState('success');
      } catch (error) {
        if (generation !== generationRef.current) return;
        setApps([]);
        setAppsState('error');
        setAppsError(toErrorMessage(error, 'Published apps could not be loaded.'));
      }
    } catch (error) {
      if (generation !== generationRef.current) return;
      setStatusState('error');
      setStatusError(
        toErrorMessage(error, 'The Google Play connection status could not be loaded.'),
      );
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      generationRef.current += 1;
    };
  }, [load]);

  // Connecting happens in a second tab (Google's consent screen). When the user
  // comes back, re-read the status so the card switches to "Connected".
  useEffect(() => {
    const handleReturn = () => {
      // `visibilitychange` also fires when the tab is hidden, so only react to
      // the transition back to a visible window.
      if (document.visibilityState !== 'visible') return;
      if (!awaitingOAuthRef.current) return;
      awaitingOAuthRef.current = false;
      void load();
    };
    window.addEventListener('focus', handleReturn);
    document.addEventListener('visibilitychange', handleReturn);
    return () => {
      window.removeEventListener('focus', handleReturn);
      document.removeEventListener('visibilitychange', handleReturn);
    };
  }, [load]);

  const handleConnect = useCallback(async () => {
    setPendingAction('connect');
    setActionError(null);
    setNotice(null);
    try {
      const { authUrl } = await startGooglePlayAuth();
      awaitingOAuthRef.current = true;
      const popup = window.open(authUrl, '_blank');
      if (!popup) {
        // Popup blocked: fall back to a full-page navigation.
        window.location.assign(authUrl);
        return;
      }
      try {
        popup.opener = null;
      } catch {
        // Cross-origin window handles can reject this; the tab still works.
      }
    } catch (error) {
      awaitingOAuthRef.current = false;
      setActionError(toErrorMessage(error, 'Google sign-in could not be started.'));
    } finally {
      setPendingAction(null);
    }
  }, []);

  const handleVerify = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const developerAccountId = developerAccountInput.trim();
      if (!developerAccountId) return;

      setPendingAction('verify');
      setActionError(null);
      setNotice(null);
      try {
        const result = await verifyGooglePlayDeveloperAccount(developerAccountId);
        if (!result.verified) {
          setActionError('Google Play did not confirm access to that developer account.');
          return;
        }
        setDeveloperAccountInput('');
        setNotice(`Developer account ${result.developerAccountId} verified.`);
        await load();
      } catch (error) {
        setActionError(
          toErrorMessage(error, 'The developer account could not be verified.'),
        );
      } finally {
        setPendingAction(null);
      }
    },
    [developerAccountInput, load],
  );

  const handleRefresh = useCallback(async () => {
    setPendingAction('refresh');
    setActionError(null);
    setNotice(null);
    try {
      await refreshGooglePlayToken();
      setNotice('Access token refreshed.');
      await load();
    } catch (error) {
      setActionError(toErrorMessage(error, 'The access token could not be refreshed.'));
    } finally {
      setPendingAction(null);
    }
  }, [load]);

  const handleSync = useCallback(async () => {
    setPendingAction('sync');
    setActionError(null);
    setNotice(null);
    try {
      const result = await syncGooglePlayApps(apps);
      setNotice(`${result.created} app${result.created === 1 ? '' : 's'} added to Websites & Apps; ${result.skipped} already tracked.${result.failed ? ` ${result.failed} failed.` : ''}`);
    } catch (error) {
      setActionError(toErrorMessage(error, 'Published apps could not be synced.'));
    } finally {
      setPendingAction(null);
    }
  }, [apps]);

  const handleDisconnect = useCallback(async () => {
    const confirmed = window.confirm(
      'Disconnect this Google Play Console account? Published apps will no longer be listed until you connect again.',
    );
    if (!confirmed) return;

    setPendingAction('disconnect');
    setActionError(null);
    setNotice(null);
    try {
      await disconnectGooglePlay();
      setApps([]);
      setAppsState('idle');
      setAppsError(null);
      setDeveloperAccountInput('');
      setNotice('Google Play Console disconnected.');
      await load();
    } catch (error) {
      setActionError(
        toErrorMessage(error, 'The Google Play account could not be disconnected.'),
      );
    } finally {
      setPendingAction(null);
    }
  }, [load]);

  const connected = connection?.connected === true;
  const hasDeveloperAccount = Boolean(connection?.developerAccount?.id);

  return (
    <div className="flex w-full flex-col gap-unit-lg pb-unit-2xl">
      <PageHeader
        description="Link a Google Play developer account to review the Android apps you publish. DomainPulse only reads the app list — it never edits store listings, pricing or releases."
        title="Google Play Console"
      />

      {notice && (
        <div
          className="rounded-lg border border-primary/30 bg-primary/5 p-unit-sm font-body-sm text-body-sm text-on-surface"
          role="status"
        >
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-unit-lg lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <section
          aria-labelledby="google-play-connection-heading"
          className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-micro"
        >
          <div className="flex items-start justify-between gap-unit-sm">
            <div className="flex min-w-0 items-center gap-unit-sm">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  connected ? 'bg-primary/10 text-primary' : 'bg-surface-container text-secondary'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">play_store</span>
              </span>
              <div className="min-w-0">
                <h2
                  className="font-headline-sm text-headline-sm font-semibold text-on-surface"
                  id="google-play-connection-heading"
                >
                  Connection
                </h2>
                <p className="font-caption-xs text-caption-xs text-secondary">
                  {connected
                    ? 'Google Play Console is linked'
                    : 'No Google account linked yet'}
                </p>
              </div>
            </div>
            {statusState === 'ready' && <StatusPill connected={connected} />}
          </div>

          {statusState === 'loading' && connection === null && (
            <p
              className="mt-unit-lg flex items-center gap-unit-xs font-body-sm text-body-sm text-secondary"
              role="status"
            >
              <span className="material-symbols-outlined animate-spin text-[16px]">
                progress_activity
              </span>
              Checking your Google Play connection…
            </p>
          )}

          {statusState === 'error' && (
            <div className="mt-unit-lg rounded-lg border border-error/30 bg-error/5 p-unit-sm" role="alert">
              <p className="font-label-md text-label-md font-semibold text-error">
                Status unavailable
              </p>
              <p className="mt-unit-2xs font-body-sm text-body-sm text-secondary">{statusError}</p>
              <Button
                className="mt-unit-sm"
                iconLeading="refresh"
                onClick={() => void load()}
                size="sm"
                variant="outline"
              >
                Try again
              </Button>
            </div>
          )}

          {connected && (
            <dl className="mt-unit-lg flex flex-col gap-unit-sm">
              <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-unit-sm">
                <dt className="font-caption-xs font-semibold uppercase tracking-wider text-secondary">
                  Google account
                </dt>
                <dd className="mt-unit-2xs break-all font-body-sm text-body-sm text-on-surface">
                  {connection?.googleAccount?.email ?? 'Unknown account'}
                </dd>
              </div>
              <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-unit-sm">
                <dt className="font-caption-xs font-semibold uppercase tracking-wider text-secondary">
                  Developer account
                </dt>
                <dd className="mt-unit-2xs break-all font-body-sm text-body-sm text-on-surface">
                  {connection?.developerAccount?.id ?? 'Not verified yet'}
                </dd>
              </div>
            </dl>
          )}

          {connected && !hasDeveloperAccount && (
            <form className="mt-unit-lg flex flex-col gap-unit-sm" onSubmit={handleVerify}>
              <label
                className="font-label-md text-label-md text-on-surface"
                htmlFor="google-play-developer-account-id"
              >
                Developer account ID
              </label>
              <p className="font-caption-xs text-caption-xs text-secondary">
                Play Console → Settings → Developer account → Account details.
              </p>
              <input
                autoComplete="off"
                className="h-9 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 font-body-sm text-body-sm text-on-surface shadow-micro placeholder:text-outline focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                id="google-play-developer-account-id"
                inputMode="numeric"
                onChange={(event) => setDeveloperAccountInput(event.target.value)}
                placeholder="e.g. 5700313618786177705"
                value={developerAccountInput}
              />
              <Button
                disabled={!developerAccountInput.trim() || pendingAction === 'verify'}
                iconLeading="verified"
                type="submit"
                variant="primary"
              >
                {pendingAction === 'verify' ? 'Verifying…' : 'Verify developer account'}
              </Button>
            </form>
          )}

          {connected && hasDeveloperAccount && (
            <div className="mt-unit-lg">
              <div className="flex items-center justify-between gap-unit-sm">
                <h3 className="font-label-md text-label-md font-semibold text-on-surface">
                  Published apps
                </h3>
                {appsState === 'success' && (
                  <span className="font-caption-xs text-caption-xs text-secondary">
                    {apps.length} {apps.length === 1 ? 'app' : 'apps'}
                  </span>
                )}
              </div>

              {appsState === 'loading' && (
                <p className="mt-unit-sm flex items-center gap-unit-xs font-body-sm text-body-sm text-secondary" role="status">
                  <span className="material-symbols-outlined animate-spin text-[16px]">
                    progress_activity
                  </span>
                  Loading apps…
                </p>
              )}

              {appsState === 'error' && (
                <div className="mt-unit-sm rounded-lg border border-error/30 bg-error/5 p-unit-sm" role="alert">
                  <p className="font-label-md text-label-md font-semibold text-error">
                    Apps unavailable
                  </p>
                  <p className="mt-unit-2xs font-body-sm text-body-sm text-secondary">{appsError}</p>
                  <Button
                    className="mt-unit-sm"
                    iconLeading="refresh"
                    onClick={() => void load()}
                    size="sm"
                    variant="outline"
                  >
                    Try again
                  </Button>
                </div>
              )}

              {appsState === 'success' && apps.length === 0 && (
                <p className="mt-unit-sm font-body-sm text-body-sm text-secondary">
                  No published apps were returned for this developer account.
                </p>
              )}

              {apps.length > 0 && (
                <>
                <div className="mt-unit-sm flex flex-wrap items-center justify-between gap-unit-sm rounded-lg border border-primary/20 bg-primary/5 p-unit-sm">
                  <p className="text-caption-xs text-secondary">Keep this workspace&apos;s mobile app inventory in sync with Play Console.</p>
                  <Button disabled={pendingAction !== null} iconLeading="sync" onClick={() => void handleSync()} size="sm" variant="primary">
                    {pendingAction === 'sync' ? 'Syncing…' : 'Sync apps to inventory'}
                  </Button>
                </div>
                <ul className="mt-unit-sm flex max-h-64 flex-col gap-unit-2xs overflow-y-auto pr-1">
                  {apps.map((app) => (
                    <li
                      className="flex items-start gap-unit-sm rounded-lg border border-outline-variant/30 bg-surface-container-low p-unit-sm"
                      key={app.packageName}
                    >
                      <span className="material-symbols-outlined mt-0.5 text-[18px] text-secondary">
                        android
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-body-sm text-body-sm font-medium text-on-surface">
                          {app.appName}
                        </p>
                        <p className="truncate font-caption-xs text-caption-xs text-secondary">
                          {app.packageName}
                        </p>
                      </div>
                      <a
                        className="inline-flex shrink-0 items-center gap-0.5 font-label-md text-label-md text-primary transition-colors hover:text-tertiary"
                        href={app.playStoreUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Open
                        <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                      </a>
                    </li>
                  ))}
                </ul>
                </>
              )}
            </div>
          )}

          <div className="mt-unit-lg flex flex-col gap-unit-sm border-t border-outline-variant/30 pt-unit-lg">
            {connected ? (
              <>
                <Button
                  disabled={pendingAction === 'refresh'}
                  iconLeading="refresh"
                  onClick={() => void handleRefresh()}
                  variant="secondary"
                >
                  {pendingAction === 'refresh' ? 'Refreshing…' : 'Refresh access token'}
                </Button>
                <Button
                  disabled={pendingAction === 'disconnect'}
                  iconLeading="link_off"
                  onClick={() => void handleDisconnect()}
                  variant="destructive"
                >
                  {pendingAction === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  disabled={pendingAction === 'connect' || statusState === 'loading'}
                  iconLeading="login"
                  onClick={() => void handleConnect()}
                  size="lg"
                  variant="primary"
                >
                  {pendingAction === 'connect'
                    ? 'Opening Google sign-in…'
                    : 'Connect Google Play Console'}
                </Button>
                <p className="font-caption-xs text-caption-xs text-secondary">
                  A new tab opens on Google&apos;s consent screen. Return to this tab when you
                  are done — the connection status refreshes automatically.
                </p>
              </>
            )}
          </div>

          {actionError && (
            <div className="mt-unit-lg rounded-lg border border-error/30 bg-error/5 p-unit-sm" role="alert">
              <p className="font-body-sm text-body-sm text-on-surface">{actionError}</p>
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-unit-lg">
          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-micro">
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              What this connection reads
            </h2>
            <ul className="mt-unit-md flex flex-col gap-unit-md font-body-sm text-body-sm text-secondary">
              <li className="flex gap-unit-sm">
                <span className="material-symbols-outlined mt-0.5 shrink-0 text-[18px] text-secondary">
                  apps
                </span>
                <span>
                  Every app published by the verified developer account, with its package name
                  and a direct Play Store link.
                </span>
              </li>
              <li className="flex gap-unit-sm">
                <span className="material-symbols-outlined mt-0.5 shrink-0 text-[18px] text-secondary">
                  security
                </span>
                <span>
                  OAuth tokens are encrypted on the server and never exposed to the browser
                  after the connection completes.
                </span>
              </li>
              <li className="flex gap-unit-sm">
                <span className="material-symbols-outlined mt-0.5 shrink-0 text-[18px] text-secondary">
                  sync
                </span>
                <span>
                  Refreshing the access token renews access without disconnecting the account.
                  Disconnecting removes the stored tokens.
                </span>
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-micro">
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              Before you connect
            </h2>
            <ol className="mt-unit-md flex list-decimal flex-col gap-unit-sm pl-5 font-body-sm text-body-sm text-secondary">
              <li>Accept the Play Console invitation for the Google account you will use.</li>
              <li>Sign in with that same account on Google&apos;s consent screen.</li>
              <li>
                Verify the numeric developer account ID shown in Play Console → Settings →
                Developer account.
              </li>
            </ol>
          </section>

          {user && (
            <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-micro">
              <h2 className="font-caption-xs font-semibold uppercase tracking-wider text-secondary">
                Signed in as
              </h2>
              <p className="mt-unit-2xs break-all font-body-sm text-body-sm text-on-surface">
                {user.displayName || user.email}
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};
