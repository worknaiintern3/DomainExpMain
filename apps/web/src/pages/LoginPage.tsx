import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/common/Button';
import { useAuth } from '@/auth/AuthContext';

export const LoginPage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await auth.login({ email, password, rememberMe });
      const state = location.state as { from?: string } | null;
      navigate(state?.from ?? '/overview', { replace: true });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 429) {
        const detail = (err as { detail?: string }).detail;
        setMessage(detail || 'Too many requests. Please wait a moment before trying again.');
      } else if (err && typeof err === 'object' && 'detail' in err && typeof (err as { detail: unknown }).detail === 'string') {
        setMessage((err as { detail: string }).detail);
      } else {
        setMessage('Sign-in failed. Check your email and password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const signInWithGoogle = async () => {
    setMessage(null);
    setGoogleSubmitting(true);
    try {
      // On success this navigates the whole page away to Google, so
      // `setGoogleSubmitting(false)` never needs to run in that case.
      await auth.startGoogleLogin(rememberMe);
    } catch {
      setMessage('Could not start Google sign-in. Please try again.');
      setGoogleSubmitting(false);
    }
  };

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to pick up where you left off.">
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <LabeledInput label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <LabeledInput label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <label className="flex cursor-pointer items-start gap-3 text-body-sm text-on-surface">
          <input
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="font-semibold">Remember me on this device</span>
            <span className="mt-0.5 block text-caption-xs font-normal text-secondary">Stay signed in when you reopen your browser.</span>
          </span>
        </label>
        {(message ?? auth.error) && <p role="alert" className="text-body-sm text-error">{message ?? auth.error}</p>}
        <Button type="submit" variant="primary" size="lg" className="h-12 w-full" disabled={submitting || googleSubmitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-outline-variant" />
          <span className="text-caption-xs text-secondary">OR</span>
          <span className="h-px flex-1 bg-outline-variant" />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="h-12 w-full"
          disabled={googleSubmitting || submitting}
          onClick={() => void signInWithGoogle()}
        >
          {googleSubmitting ? 'Redirecting…' : 'Sign in with Google'}
        </Button>
        <p className="pt-2 text-center text-body-sm text-secondary">
          New to DomainPulse? <Link className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline" to="/register">Create an account</Link>
        </p>
      </form>
    </AuthCard>
  );
};

export const AuthCard: React.FC<React.PropsWithChildren<{ title: string; subtitle: string }>> = ({ children, subtitle, title }) => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const landingUrl = env?.['VITE_LANDING_URL']?.trim() || '/';

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-6 sm:px-8 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-primary-fixed/55 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-tertiary-container/70 blur-3xl" />
      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-modal lg:grid-cols-[0.95fr_1.05fr]" aria-labelledby="auth-title">
        <div className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden bg-primary px-10 py-10 text-on-primary lg:flex">
          <div aria-hidden="true" className="absolute -right-32 -top-24 h-80 w-80 rounded-full border border-white/15 bg-white/5" />
          <div aria-hidden="true" className="absolute -bottom-28 -left-32 h-96 w-96 rounded-full border border-white/15 bg-white/5" />
          <a href={landingUrl} className="relative z-10 inline-flex w-fit items-center gap-2.5 rounded-lg text-lg font-bold tracking-tight text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            <img src="/logo.png" alt="DomainPulse" className="h-9 w-9 rounded-xl object-cover shadow-micro border border-white/20" />
            DomainPulse
          </a>
          <div className="relative z-10">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-caption-xs font-semibold tracking-wide text-white/90">
              <span className="h-1.5 w-1.5 rounded-full bg-healthy" /> YOUR WORKSPACE
            </p>
            <h2 className="max-w-sm text-4xl font-semibold leading-tight tracking-tight text-white">Every domain and server, in one clear view.</h2>
            <p className="mt-5 max-w-sm text-body-lg leading-relaxed text-white/75">Stay on top of renewals, infrastructure, and the details that keep your sites running.</p>
            <div className="mt-9 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-white/15 pb-4">
                <span className="text-body-sm font-semibold">Your portfolio at a glance</span>
                <span className="material-symbols-outlined text-white/70">space_dashboard</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-body-sm text-white/85">
                <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">language</span> Domains</span>
                <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">dns</span> Servers</span>
                <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">monitor_heart</span> Monitoring</span>
                <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">notifications_active</span> Alerts</span>
              </div>
            </div>
          </div>
          <p className="relative z-10 text-caption-xs text-white/60">A calmer way to manage your web portfolio.</p>
        </div>
        <div className="flex min-w-0 flex-col px-6 py-7 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-body-sm font-bold tracking-tight text-on-surface lg:hidden">
              <img src="/logo.png" alt="DomainPulse" className="h-8 w-8 rounded-lg object-cover shadow-micro border border-outline-variant/30" />
              DomainPulse
            </span>
            <a href={landingUrl} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-body-sm font-semibold text-primary transition-colors hover:bg-primary-fixed/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to website
            </a>
          </div>
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 lg:py-12">
            <div className="mb-8">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-fixed text-primary">
                <span className="material-symbols-outlined">lock_open</span>
              </div>
              <h1 id="auth-title" className="text-display-lg-mobile font-semibold tracking-tight text-on-surface sm:text-display-lg">{title}</h1>
              <p className="mt-2 text-body-md text-secondary">{subtitle}</p>
            </div>
            {children}
          </div>
          <p className="text-center text-caption-xs text-secondary">Your workspace, right where you left it.</p>
        </div>
      </section>
    </main>
  );
};

export const LabeledInput: React.FC<{
  autoComplete?: string;
  label: string;
  minLength?: number;
  onChange(value: string): void;
  type?: string;
  value: string;
}> = ({ autoComplete, label, minLength, onChange, type = 'text', value }) => (
  <label className="flex flex-col gap-1.5 text-label-md font-medium text-on-surface">
    {label}
    <input
      autoComplete={autoComplete}
      className="h-12 rounded-lg border border-outline-variant bg-surface-container-lowest px-3.5 text-body-md text-on-surface transition-colors placeholder:text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 focus-visible:outline-2 focus-visible:outline-primary"
      minLength={minLength}
      onChange={(event) => onChange(event.target.value)}
      required
      type={type}
      value={value}
    />
  </label>
);
