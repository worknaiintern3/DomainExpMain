import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { readAndClearGoogleOAuthIntent, useAuth, type GoogleOAuthIntent } from '@/auth/AuthContext';

import { AuthCard } from './LoginPage';

type CallbackState = 'cancelled' | 'failed' | 'processing' | 'session-expired';

interface ParsedCallback {
  code: string;
  state: string;
}

/**
 * Google redirects the top-level browser window here with `code`+`state`
 * (or an `error` parameter if the user declined consent) in the query
 * string. This page never renders any of those values -- it reads them
 * once, scrubs them from the visible URL/history immediately, and forwards
 * only `code`/`state` to the backend over a POST body, never a URL.
 *
 * It serves TWO distinct flows: an unauthenticated LOGIN (from the sign-in
 * page) and an authenticated LINK/Connect-Google return (from the Security
 * page). Which one applies is read from a non-secret sessionStorage intent
 * marker written just before the redirect to Google -- that marker is UX
 * routing only, never security authority; the backend's own
 * `oauth_transactions.flow` is what actually enforces which action a given
 * `state` may complete. Because this page must be reachable by both a
 * signed-out caller (login) and a signed-in caller (link), it is
 * deliberately routed OUTSIDE both `GuestRoute` and `ProtectedRoute`.
 */
export const GoogleCallbackPage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [callbackState, setCallbackState] = useState<CallbackState>('processing');
  // `intentRef.current` can legitimately end up `null` (no/corrupt marker),
  // so a separate `attemptedRef` -- not "is intentRef still null?" -- is
  // what guards against a second run (e.g. React StrictMode's dev-only
  // double-invoke of effects).
  const attemptedRef = useRef(false);
  const intentRef = useRef<GoogleOAuthIntent | null>(null);
  const parsedRef = useRef<ParsedCallback | null>(null);
  const linkAttemptedRef = useRef(false);

  // Runs once: parse + immediately scrub the URL, read (and clear) the
  // intent marker, and handle the LOGIN path -- which never needs to wait
  // for anything, since it establishes the session itself.
  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const oauthState = params.get('state');
    const googleError = params.get('error');

    // Scrub the query string from the visible URL/history as early as
    // possible, before any async work -- a captured/replayed URL from
    // browser history should never re-trigger this flow.
    window.history.replaceState(null, '', window.location.pathname);

    const intent = readAndClearGoogleOAuthIntent();
    intentRef.current = intent;

    if (googleError) {
      // The user declined consent (or another Google-side error occurred):
      // never call the backend with this -- there is no code to exchange.
      setCallbackState('cancelled');
      return;
    }

    if (!code || !oauthState) {
      setCallbackState('failed');
      return;
    }

    if (intent !== 'login' && intent !== 'link') {
      // No (or a corrupted) intent marker -- this page was reached without
      // ever going through `startGoogleLogin`/`startGoogleLink` in this
      // browser. Fail closed rather than guessing: never call either
      // callback, never hold on to `code`/`state` past this point.
      setCallbackState('failed');
      return;
    }

    parsedRef.current = { code, state: oauthState };

    if (intent === 'login') {
      void (async () => {
        try {
          await auth.completeGoogleLogin(code, oauthState);
          navigate('/overview', { replace: true });
        } catch {
          setCallbackState('failed');
        }
      })();
    }
    // For 'link', the effect below waits for session restoration first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handles the LINK return once the existing DomainPulse session has had a
  // chance to restore from the refresh token already in sessionStorage
  // (which survives the top-level navigation to and from Google). Never
  // attempts the authenticated link call while a session might still be
  // restoring, and never attempts it at all if restoration fails.
  useEffect(() => {
    if (intentRef.current !== 'link') return;
    if (linkAttemptedRef.current) return;
    if (auth.status === 'booting') return;

    const parsed = parsedRef.current;
    if (!parsed) return;

    if (auth.status !== 'authenticated') {
      linkAttemptedRef.current = true;
      setCallbackState('session-expired');
      return;
    }

    linkAttemptedRef.current = true;
    void (async () => {
      try {
        await auth.completeGoogleLink(parsed.code, parsed.state);
        navigate('/security', { replace: true, state: { googleConnected: true } });
      } catch {
        setCallbackState('failed');
      }
    })();
  }, [auth, auth.status, navigate]);

  if (callbackState === 'processing') {
    return (
      <AuthCard title="Signing you in" subtitle="Completing sign-in with Google…">
        <div className="flex items-center justify-center py-4">
          <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
        </div>
      </AuthCard>
    );
  }

  if (callbackState === 'cancelled') {
    return (
      <AuthCard title="Sign-in cancelled" subtitle="You cancelled Google sign-in.">
        <ReturnToLogin />
      </AuthCard>
    );
  }

  if (callbackState === 'session-expired') {
    return (
      <AuthCard
        title="Please sign in again"
        subtitle="Your session couldn't be restored, so we didn't connect Google. Sign in and try again."
      >
        <ReturnToLogin />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Sign-in failed" subtitle="We couldn't complete Google sign-in. Please try again.">
      <ReturnToLogin />
    </AuthCard>
  );
};

const ReturnToLogin: React.FC = () => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="w-full h-11 rounded-lg bg-primary text-white font-semibold text-body-md"
      onClick={() => navigate('/login', { replace: true })}
    >
      Back to sign in
    </button>
  );
};
