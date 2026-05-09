/**
 * Maximum number of concurrent WebRTC peer connections per room.
 * Beyond this threshold new joiners proxy through existing peers
 * instead of establishing direct connections, which keeps
 * bandwidth use bounded.
 */
export const MAX_PEERS_PER_ROOM = 20;

/**
 * Prefix added to every Yjs room id before it is used on the
 * wire. Keeps retro rooms isolated from other features that share
 * the same `apps/communication` deployment.
 */
export const ROOM_ID_NETWORK_PREFIX = 'frozik-retro-';

/**
 * Vite-injected env var pointing at the `apps/communication` server
 * (Socket.IO + Google OIDC). All retro WebRTC signaling negotiates
 * through this server.
 */
const ENV_COMMUNICATION_URL = import.meta.env.VITE_COMMUNICATION_URL;

const DEFAULT_COMMUNICATION_URL = 'http://localhost:4445';

export interface ISignalingConfig {
  /** Base URL of the communication server (no trailing slash). */
  readonly baseUrl: string;
  readonly maxPeers: number;
  readonly roomPrefix: string;
}

/**
 * Resolve the active signaling configuration. Kept as a function
 * (not a constant) so Vite's `import.meta.env` is read lazily —
 * simplifies testing and matches the conf module's
 * `getConfSignalingConfig()` shape.
 */
export function getSignalingConfig(): ISignalingConfig {
  const baseUrl =
    typeof ENV_COMMUNICATION_URL === 'string' && ENV_COMMUNICATION_URL.trim().length > 0
      ? ENV_COMMUNICATION_URL.trim().replace(/\/$/, '')
      : DEFAULT_COMMUNICATION_URL;
  return {
    baseUrl,
    maxPeers: MAX_PEERS_PER_ROOM,
    roomPrefix: ROOM_ID_NETWORK_PREFIX,
  };
}
