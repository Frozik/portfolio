import { decodePinnedCertificate, PINNED_CERTIFICATE_SUFFIX } from '../shared/pinned-certificate';

export interface Http3Target {
  /** `https://…` — reached over HTTP/3 (UDP). */
  readonly url: string;
  /** Pins a self-signed development certificate; production uses the public chain. */
  readonly serverCertificateHashes?: readonly WebTransportHash[];
}

export interface TransportEndpoints {
  /** Resolved on every attempt, so a development server can hand out its pinned certificate. */
  readonly http3: () => Promise<Http3Target>;
  readonly fallbackUrl: string;
}

/**
 * Where the transport lives, from the server's own URL. Behind TLS one host
 * serves both protocols: HTTP/3 on UDP 443, the WebSocket fallback on TCP 443.
 * A development server without TLS runs HTTP/3 on a self-signed certificate
 * and a port of its own, and publishes both — asked for at connect time.
 */
export function transportEndpoints(serverUrl: string, path: string): TransportEndpoints {
  const base = new URL(serverUrl);
  const isDevelopmentServer = base.protocol === 'http:';
  const fallbackUrl = `${isDevelopmentServer ? 'ws' : 'wss'}://${base.host}${path}`;
  if (!isDevelopmentServer) {
    const target: Http3Target = { url: `https://${base.host}${path}` };
    return { http3: () => Promise.resolve(target), fallbackUrl };
  }
  return {
    fallbackUrl,
    http3: async () => {
      const response = await fetch(`${base.origin}${path}${PINNED_CERTIFICATE_SUFFIX}`);
      const pinned = decodePinnedCertificate(await response.json());
      return {
        url: `https://${base.hostname}:${pinned.http3Port}${path}`,
        serverCertificateHashes: [{ algorithm: 'sha-256', value: pinned.sha256 }],
      };
    },
  };
}
