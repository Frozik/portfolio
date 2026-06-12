import { useEffect, useState } from 'react';

import { useCommunicationBaseUrl } from './CommunicationProvider';

export type TSignalingHealthStatus = 'checking' | 'ok' | 'unavailable';

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
 * One-shot liveness probe of the communication server on mount, reported as
 * `'checking' | 'ok' | 'unavailable'`. Feature roots (retro / conf) use it to
 * gate the UI: when the server is unreachable they render an error screen
 * instead of a Lobby / Room that would otherwise hang in "connecting" forever.
 *
 * Probes the SAME `baseUrl` the feature's sockets connect through
 * (`useCommunicationBaseUrl`), so the health check can never target a
 * different server than the live connection.
 */
export function useSignalingHealth(): TSignalingHealthStatus {
  const baseUrl = useCommunicationBaseUrl();
  const [status, setStatus] = useState<TSignalingHealthStatus>('checking');

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
