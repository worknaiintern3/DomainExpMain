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
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await auth.login({ email, password });
      const state = location.state as { from?: string } | null;
      navigate(state?.from ?? '/overview', { replace: true });
    } catch {
      setMessage('Sign-in failed. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your DomainPulse workspace.">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <LabeledInput label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <LabeledInput label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        {(message ?? auth.error) && <p role="alert" className="text-body-sm text-error">{message ?? auth.error}</p>}
        <Button type="submit" variant="primary" size="lg" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className="text-center text-body-sm text-secondary">
          New to DomainPulse? <Link className="text-primary font-semibold" to="/register">Create an account</Link>
        </p>
      </form>
    </AuthCard>
  );
};

export const AuthCard: React.FC<React.PropsWithChildren<{ title: string; subtitle: string }>> = ({ children, subtitle, title }) => (
  <main className="min-h-screen bg-background flex items-center justify-center p-6">
    <section className="w-full max-w-md rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-xl p-8">
      <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center mb-5">
        <span className="material-symbols-outlined">pulse_alert</span>
      </div>
      <h1 className="text-headline-md font-semibold text-on-surface">{title}</h1>
      <p className="text-body-sm text-secondary mt-1 mb-6">{subtitle}</p>
      {children}
    </section>
  </main>
);

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
      className="h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
      minLength={minLength}
      onChange={(event) => onChange(event.target.value)}
      required
      type={type}
      value={value}
    />
  </label>
);
