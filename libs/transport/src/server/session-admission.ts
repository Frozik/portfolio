import type { TransportProtocol } from '../shared/session';
import type { SessionRequest } from './peer';

export interface SessionAdmissionOptions {
  readonly allowedOrigins: readonly string[];
  readonly maxSessionsPerIp: number;
  readonly attemptsPerIpPerMinute: number;
  /**
   * Protocols whose peer address is a proxy's, not the client's (the WebSocket
   * fallback behind a TCP passthrough). Per-address limits do not apply there:
   * every client would share one address; the proxy limits per source instead.
   */
  readonly behindProxy: readonly TransportProtocol[];
  readonly now: () => number;
}

export interface SessionAdmission {
  admit(request: SessionRequest, protocol: TransportProtocol): boolean;
  opened(ip: string, protocol: TransportProtocol): void;
  closed(ip: string, protocol: TransportProtocol): void;
  /** The client's own address, or undefined where only the proxy's is known. */
  clientAddress(ip: string, protocol: TransportProtocol): string | undefined;
}

const MINUTE_MS = 60 * 1000;

/**
 * Who may open a session: no page from a foreign origin (browsers always send
 * one; other clients can claim any, so the per-address limits are what
 * actually protect the server), at most so many attempts a minute and so many
 * live sessions per address.
 */
export function createSessionAdmission(options: SessionAdmissionOptions): SessionAdmission {
  const origins = new Set(options.allowedOrigins);
  const proxied = new Set(options.behindProxy);
  const attempts = new Map<string, readonly number[]>();
  const sessions = new Map<string, number>();

  const recentAttempts = (ip: string, now: number) =>
    (attempts.get(ip) ?? []).filter(at => now - at < MINUTE_MS);

  const forgetQuietAddresses = (now: number) => {
    for (const ip of attempts.keys()) {
      if (recentAttempts(ip, now).length === 0) {
        attempts.delete(ip);
      }
    }
  };

  const countSession = (ip: string, delta: 1 | -1) => {
    const next = (sessions.get(ip) ?? 0) + delta;
    if (next <= 0) {
      sessions.delete(ip);
    } else {
      sessions.set(ip, next);
    }
  };

  return {
    admit({ ip, origin }, protocol) {
      if (origin !== undefined && !origins.has(origin)) {
        return false;
      }
      if (proxied.has(protocol)) {
        return true;
      }
      const now = options.now();
      forgetQuietAddresses(now);
      const recent = recentAttempts(ip, now);
      attempts.set(ip, [...recent, now]);
      return (
        recent.length < options.attemptsPerIpPerMinute &&
        (sessions.get(ip) ?? 0) < options.maxSessionsPerIp
      );
    },
    opened(ip, protocol) {
      if (!proxied.has(protocol)) {
        countSession(ip, 1);
      }
    },
    closed(ip, protocol) {
      if (!proxied.has(protocol)) {
        countSession(ip, -1);
      }
    },
    clientAddress: (ip, protocol) => (proxied.has(protocol) ? undefined : ip),
  };
}
