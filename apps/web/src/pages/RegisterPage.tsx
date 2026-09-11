import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/common/Button';
import { AuthCard, LabeledInput } from './LoginPage';

export const RegisterPage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await auth.register({ displayName, email, password });
      navigate('/overview', { replace: true });
    } catch (registrationError) {
      setMessage(
        registrationError instanceof ApiError
          ? registrationError.detail
          : 'Registration could not be completed.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title="Create your workspace" subtitle="Your personal workspace is created automatically.">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <label className="flex flex-col gap-1.5 text-label-md font-medium text-on-surface">
          Display name <span className="text-caption-xs text-secondary">Optional</span>
          <input className="h-11 rounded-lg border border-outline-variant px-3" maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <LabeledInput label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <LabeledInput label="Password" type="password" minLength={12} value={password} onChange={setPassword} autoComplete="new-password" />
        <p className="text-caption-xs text-secondary">Use at least 12 characters.</p>
        {message && <p role="alert" className="text-body-sm text-error">{message}</p>}
        <Button type="submit" variant="primary" size="lg" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
        <p className="text-center text-body-sm text-secondary">
          Already registered? <Link className="text-primary font-semibold" to="/login">Sign in</Link>
        </p>
      </form>
    </AuthCard>
  );
};
