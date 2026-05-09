import { getSignalingConfig } from './signaling-config';

const HEALTH_TIMEOUT_MS = 5_000;
const HEALTH_PATH = '/health/live';

/**
 * Probes the communication server's liveness endpoint before the
 * Retro feature mounts. Returns `true` when the server responds
 * with HTTP 2xx — that is enough for the client to attempt the
 * Socket.IO handshake. The probe is best-effort: a transient
 * failure should not block the user from re-trying.
 */
export async function checkSignalingHealth(): Promise<boolean> {
  const { baseUrl } = getSignalingConfig();
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
