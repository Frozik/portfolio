/**
 * Topic prefix applied to every conf room id on the wire. Keeps conf
 * rooms isolated from any retro room that might be running on the same
 * self-hosted signaling instance.
 */
export const CONF_ROOM_ID_NETWORK_PREFIX = 'frozik-conf-';

/**
 * Conf reuses the env var that already points at the self-hosted
 * `apps/signaling` server. The retro infrastructure reads the
 * same variable — we do not spin up a separate signaling deployment.
 * Comma-separated; only the first reachable URL is used by conf.
 */
const ENV_SIGNALING_URLS = import.meta.env.VITE_RETRO_SIGNALING_URLS;

export interface IConfSignalingConfig {
  readonly serverUrls: readonly string[];
  readonly roomPrefix: string;
}

function resolveServerUrls(): readonly string[] {
  if (typeof ENV_SIGNALING_URLS !== 'string' || ENV_SIGNALING_URLS.trim().length === 0) {
    return [];
  }
  return ENV_SIGNALING_URLS.split(',')
    .map(url => url.trim())
    .filter(url => url.length > 0);
}

/**
 * Resolve the conf signaling configuration. Kept as a function (not a
 * constant) so Vite's `import.meta.env` is read lazily — simplifies
 * testing and matches retro's `getSignalingConfig()` shape.
 */
export function getConfSignalingConfig(): IConfSignalingConfig {
  return {
    serverUrls: resolveServerUrls(),
    roomPrefix: CONF_ROOM_ID_NETWORK_PREFIX,
  };
}

/** Build the topic string used to subscribe/publish for a given room. */
export function getConfRoomTopic(roomId: string): string {
  return `${CONF_ROOM_ID_NETWORK_PREFIX}${roomId}`;
}
