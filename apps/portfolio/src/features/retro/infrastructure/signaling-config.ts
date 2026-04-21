/**
 * Signaling server endpoints for `y-webrtc`'s WebRTC peer discovery.
 *
 * `y-webrtc` needs at least one signaling server to broker the initial SDP
 * exchange between peers — after that, data flows peer-to-peer over a
 * direct WebRTC DataChannel and the server is no longer involved.
 *
 * The defaults below are the public signaling servers maintained by the
 * Yjs community. We deliberately list more than one so that a single
 * server outage does not take the feature offline.
 */
export const DEFAULT_SIGNALING_SERVERS: readonly string[] = [
  'wss://y-webrtc-eu.fly.dev',
  'wss://signaling.yjs.dev',
];

/**
 * Vite-injected env var. When set, its comma-separated value overrides the
 * public defaults. Useful for running a local signaling server during
 * development (`npx y-webrtc-signaling --port 4444`) and for self-hosted
 * deployments:
 *
 *   VITE_RETRO_SIGNALING_URLS="ws://localhost:4444" pnpm dev
 *   VITE_RETRO_SIGNALING_URLS="wss://my-signaling.fly.dev" pnpm build
 */
const ENV_SIGNALING_URLS = import.meta.env.VITE_RETRO_SIGNALING_URLS;

function resolveSignalingServers(): readonly string[] {
  if (typeof ENV_SIGNALING_URLS !== 'string' || ENV_SIGNALING_URLS.trim().length === 0) {
    return DEFAULT_SIGNALING_SERVERS;
  }
  return ENV_SIGNALING_URLS.split(',')
    .map(url => url.trim())
    .filter(url => url.length > 0);
}

/**
 * Maximum number of concurrent WebRTC peer connections per room. Beyond
 * this threshold, new joiners will proxy through existing peers instead
 * of establishing a direct connection, which keeps bandwidth use bounded.
 */
export const MAX_PEERS_PER_ROOM = 20;

/**
 * Prefix added to every Yjs room id before it is used on the wire. Keeps
 * our rooms isolated from any other application that might be using the
 * same public signaling servers.
 */
export const ROOM_ID_NETWORK_PREFIX = 'frozik-retro-';

export interface ISignalingConfig {
  readonly signalingServers: readonly string[];
  readonly maxPeers: number;
  readonly roomPrefix: string;
}

/**
 * Resolve the active signaling configuration. The function is the single
 * seam through which the rest of the infrastructure layer reaches the
 * network defaults — it makes the config trivially overrideable in tests.
 */
export function getSignalingConfig(): ISignalingConfig {
  return {
    signalingServers: resolveSignalingServers(),
    maxPeers: MAX_PEERS_PER_ROOM,
    roomPrefix: ROOM_ID_NETWORK_PREFIX,
  };
}
