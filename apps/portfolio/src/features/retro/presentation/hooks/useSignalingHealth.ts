import { useEffect, useState } from 'react';

import { checkSignalingHealth } from '../../infrastructure/signaling-health';

export type TSignalingHealthStatus = 'checking' | 'ok' | 'unavailable';

/**
 * Runs a one-shot `/health` probe against the configured signaling
 * servers on mount and reports the outcome to the caller. Used by the
 * Retro feature root to gate the UI: if nobody answers, we show an error
 * screen instead of the Lobby / Room, which would otherwise hang in
 * "connecting" state forever.
 */
export function useSignalingHealth(): TSignalingHealthStatus {
  const [status, setStatus] = useState<TSignalingHealthStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    void checkSignalingHealth().then(isAvailable => {
      if (!cancelled) {
        setStatus(isAvailable ? 'ok' : 'unavailable');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
