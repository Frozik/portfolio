import { useEffect, useState } from 'react';

import { useCommunicationBaseUrl } from '../../../../shared/communication/CommunicationProvider';

export type TConfSignalingHealthStatus = 'checking' | 'ok' | 'unavailable';

const HEALTH_TIMEOUT_MS = 5_000;
const HEALTH_PATH = '/health/live';

function toLivenessUrl(baseUrl: string): string | null {
  try {
    const parsed = new URL(baseUrl);
    parsed.pathname = HEALTH_PATH;
    parsed.search = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

async function probe(baseUrl: string): Promise<boolean> {
  const probeUrl = toLivenessUrl(baseUrl);
  if (probeUrl === null) {
    return false;
  }
  try {
    const response = await fetch(probeUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Probes the communication server's liveness endpoint on mount and
 * reports the outcome. Used by the Conf feature root to gate the
 * UI: if the server is unreachable, we render an error screen
 * instead of the Lobby / Room which would otherwise hang in
 * "connecting" state forever.
 */
export function useConfSignalingHealth(): TConfSignalingHealthStatus {
  const baseUrl = useCommunicationBaseUrl();
  const [status, setStatus] = useState<TConfSignalingHealthStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    void probe(baseUrl).then(isAvailable => {
      if (!cancelled) {
        setStatus(isAvailable ? 'ok' : 'unavailable');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  return status;
}
