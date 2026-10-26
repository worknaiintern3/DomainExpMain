import { useCallback, useEffect, useRef, useState } from 'react';

import { probeApplicationUrl, type ApplicationProbeResult } from '@/api/applicationProbe';

import { probeRequestErrorMessage } from './applicationProbe';

export type ProbeEntry =
  | { state: 'loading' }
  | { result: ApplicationProbeResult; state: 'done' }
  | { message: string; state: 'failed' };

/**
 * Per-record on-demand probe state. Results live only in component state:
 * nothing is stored, and starting a new probe for a record cancels its
 * previous in-flight request.
 */
export function useApplicationProbe(): {
  entries: Readonly<Record<string, ProbeEntry>>;
  run: (id: string, url: string | null) => Promise<void>;
} {
  const [entries, setEntries] = useState<Record<string, ProbeEntry>>({});
  const mounted = useRef(true);
  const controllers = useRef(new Map<string, AbortController>());

  useEffect(() => {
    mounted.current = true;
    const active = controllers.current;
    return () => {
      mounted.current = false;
      active.forEach((controller) => controller.abort());
      active.clear();
    };
  }, []);

  const run = useCallback(async (id: string, url: string | null): Promise<void> => {
    if (!url) return;
    controllers.current.get(id)?.abort();
    const controller = new AbortController();
    controllers.current.set(id, controller);
    setEntries((current) => ({ ...current, [id]: { state: 'loading' } }));

    const isCurrent = () => mounted.current && controllers.current.get(id) === controller;
    try {
      const result = await probeApplicationUrl(url, controller.signal);
      if (isCurrent()) setEntries((current) => ({ ...current, [id]: { result, state: 'done' } }));
    } catch (error) {
      if (isCurrent()) {
        setEntries((current) => ({
          ...current,
          [id]: { message: probeRequestErrorMessage(error), state: 'failed' },
        }));
      }
    } finally {
      if (controllers.current.get(id) === controller) controllers.current.delete(id);
    }
  }, []);

  return { entries, run };
}
