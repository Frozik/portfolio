import { useEffect, useState } from 'react';

import { getConfSignalingConfig } from '../../infrastructure';

export type TConfSignalingHealthStatus = 'checking' | 'ok' | 'unavailable';

const HEALTH_TIMEOUT_MS = 5_000;
const HEALTH_PATH = '/health';

function toHealthUrl(signalingUrl: string): string | null {
  try {
    const parsed = new URL(signalingUrl);
    if (parsed.protocol === 'wss:') {
      parsed.protocol = 'https:';
    } else if (parsed.protocol === 'ws:') {
      parsed.protocol = 'http:';
    } else {
      return null;
    }
    parsed.pathname = HEALTH_PATH;
    parsed.search = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

async function probeOne(signalingUrl: string): Promise<boolean> {
  const healthUrl = toHealthUrl(signalingUrl);
  if (healthUrl === null) {
    return false;
  }
  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkConfSignalingHealth(): Promise<boolean> {
  const { serverUrls } = getConfSignalingConfig();
  if (serverUrls.length === 0) {
    return false;
  }
  const probes = serverUrls.map(probeOne);
  const results = await Promise.all(probes);
  return results.some(isOk => isOk);
}

/**
 * Runs a one-shot `/health` probe against the configured signaling
 * servers on mount and reports the outcome. Used by the Conf feature
 * root to gate the UI: if nobody answers, we show an error screen
 * instead of the Lobby / Room which would otherwise hang in the
 * "connecting" state.
 */
export function useConfSignalingHealth(): TConfSignalingHealthStatus {
  const [status, setStatus] = useState<TConfSignalingHealthStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    void checkConfSignalingHealth().then(isAvailable => {
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
