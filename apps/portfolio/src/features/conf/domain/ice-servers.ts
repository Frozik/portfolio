/**
 * STUN endpoints used by `RTCPeerConnection` for NAT reflection.
 *
 * Conf is STUN-only by design — no TURN relay is provisioned, which
 * means ~30 % of symmetric-NAT'd sessions will fail to connect. This
 * trade-off is documented in the portfolio README; relaying real-time
 * media through a TURN server is out of scope for a demo app.
 */
export const GOOGLE_STUN_URLS: readonly string[] = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
];

/**
 * Default `RTCIceServer` list passed straight into `RTCPeerConnection`.
 * Kept separate from the URL list so the infrastructure layer can
 * supply it without reshaping the data on every call.
 */
export const DEFAULT_ICE_SERVERS: readonly RTCIceServer[] = [{ urls: [...GOOGLE_STUN_URLS] }];
