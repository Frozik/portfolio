import { getSignalingConfig } from './signaling-config';

const HEALTH_TIMEOUT_MS = 5_000;
const HEALTH_PATH = '/health';

/**
 * Probes the signaling servers' `/health` endpoints before the Retro
 * feature mounts. Returns `true` if at least one server responds with
 * HTTP 2xx — that is enough for the client to establish a WebRTC room,
 * since `y-webrtc` is happy with any reachable signaling peer.
 *
 * The fetch is fired in parallel across all configured URLs and aborts
 * after `HEALTH_TIMEOUT_MS` so a dead server does not block the app from
 * reporting "unavailable".
 */
export async function checkSignalingHealth(): Promise<boolean> {
  const { signalingServers } = getSignalingConfig();
  if (signalingServers.length === 0) {
    return false;
  }
  const probes = signalingServers.map(probeOne);
  const results = await Promise.all(probes);
  return results.some(isOk => isOk);
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
