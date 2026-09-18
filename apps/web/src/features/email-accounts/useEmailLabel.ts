import { useEffect, useState } from 'react';

import { useAuth } from '@/auth/AuthContext';
import {
  activateEmailCacheScope,
  getCachedEmailAccount,
  resolveEmailAccount,
} from './email-cache';

type EmailLabelState =
  | { label: string; status: 'ready' }
  | { label: null; status: 'resolving' | 'unavailable' };

interface EmailLabelSnapshot {
  result: EmailLabelState;
  scopeKey: string | null;
}

function labelFor(email: string, label: string | null): string {
  return label?.trim() ? `${label} (${email})` : email;
}

export function useEmailLabel(id: string): EmailLabelState {
  const { sessionScopeKey } = useAuth();
  const [snapshot, setSnapshot] = useState<EmailLabelSnapshot>({
    result: { label: null, status: 'resolving' },
    scopeKey: null,
  });

  useEffect(() => {
    activateEmailCacheScope(sessionScopeKey);
    const cached = getCachedEmailAccount(id);
    if (cached) {
      setSnapshot({
        result: { label: labelFor(cached.email, cached.label), status: 'ready' },
        scopeKey: sessionScopeKey,
      });
      return;
    }

    let current = true;
    setSnapshot({ result: { label: null, status: 'resolving' }, scopeKey: sessionScopeKey });
    void resolveEmailAccount(id).then((account) => {
      if (current) {
        setSnapshot({
          result: { label: labelFor(account.email, account.label), status: 'ready' },
          scopeKey: sessionScopeKey,
        });
      }
    }).catch(() => {
      if (current) {
        setSnapshot({
          result: { label: null, status: 'unavailable' },
          scopeKey: sessionScopeKey,
        });
      }
    });
    return () => { current = false; };
  }, [id, sessionScopeKey]);

  return snapshot.scopeKey === sessionScopeKey
    ? snapshot.result
    : { label: null, status: 'resolving' };
}
