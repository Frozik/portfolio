import { MS_PER_MINUTE, MS_PER_SECOND } from '@frozik/utils/date/constants';
import type { Socket } from 'socket.io';
import type { IServerConfig } from '../application/config/server-config-schema';

const HANDSHAKE_BLOCK_PRUNE_FACTOR = 2;
const ATTEMPT_WINDOW_MS = MS_PER_MINUTE;
const UNKNOWN_REMOTE_IP = 'unknown';

type FailureWindow = {
  failures: number;
  blockedUntilMs: number;
  windowStartMs: number;
};

type AttemptWindow = {
  attempts: number;
  windowStartMs: number;
};

export type HandshakeVerdict = 'allowed' | 'rate-limited';

/**
 * Per-IP handshake accounting. Socket.IO handshakes never reach the fastify
 * rate-limit plugin (engine.io intercepts the request before routing), so the
 * total attempt rate is limited here, and a run of failed handshakes blocks
 * the source for a while.
 */
export class HandshakeRateLimiter {
  private readonly failureWindows = new Map<string, FailureWindow>();
  private readonly attemptWindows = new Map<string, AttemptWindow>();
  private readonly blockWindowMs: number;
  private readonly blockThreshold: number;
  private readonly attemptsPerMinute: number;

  constructor(security: IServerConfig['security']) {
    this.blockWindowMs = security.failed_handshake_block_seconds * MS_PER_SECOND;
    this.blockThreshold = security.failed_handshake_block_threshold;
    this.attemptsPerMinute = security.handshake_rate_per_ip_per_minute;
  }

  /** Counts one attempt and answers whether this source may proceed right now. */
  admit(remoteIp: string, nowMs: number): HandshakeVerdict {
    const blocked = this.failureWindows.get(remoteIp);
    if (blocked !== undefined && blocked.blockedUntilMs > nowMs) {
      return 'rate-limited';
    }
    const verdict = this.consumeAttempt(remoteIp, nowMs) ? 'allowed' : 'rate-limited';
    this.pruneStale(nowMs);
    return verdict;
  }

  /** A failed handshake; enough of them in a window block the source for another. */
  registerFailure(remoteIp: string, nowMs: number): void {
    const window = this.failureWindows.get(remoteIp) ?? {
      failures: 0,
      blockedUntilMs: 0,
      windowStartMs: nowMs,
    };
    if (nowMs - window.windowStartMs > this.blockWindowMs) {
      window.failures = 0;
      window.windowStartMs = nowMs;
    }
    window.failures += 1;
    if (window.failures >= this.blockThreshold) {
      window.blockedUntilMs = nowMs + this.blockWindowMs;
    }
    this.failureWindows.set(remoteIp, window);
  }

  /** Sliding-window counter for TOTAL attempts; false once the per-minute budget is spent. */
  private consumeAttempt(remoteIp: string, nowMs: number): boolean {
    const window = this.attemptWindows.get(remoteIp) ?? { attempts: 0, windowStartMs: nowMs };
    if (nowMs - window.windowStartMs > ATTEMPT_WINDOW_MS) {
      window.attempts = 0;
      window.windowStartMs = nowMs;
    }
    window.attempts += 1;
    this.attemptWindows.set(remoteIp, window);
    return window.attempts <= this.attemptsPerMinute;
  }

  /** Keeps memory bounded: windows whose block and rolling period have both elapsed go. */
  private pruneStale(nowMs: number): void {
    const failureExpiryMs = this.blockWindowMs * HANDSHAKE_BLOCK_PRUNE_FACTOR;
    for (const [ip, window] of this.failureWindows) {
      if (window.blockedUntilMs < nowMs && nowMs - window.windowStartMs > failureExpiryMs) {
        this.failureWindows.delete(ip);
      }
    }
    for (const [ip, window] of this.attemptWindows) {
      if (nowMs - window.windowStartMs > ATTEMPT_WINDOW_MS) {
        this.attemptWindows.delete(ip);
      }
    }
  }
}

/**
 * The raw TCP source address. Behind HAProxy (TCP/SNI passthrough) this is
 * always the loopback — per-IP accounting is disabled in that mode
 * (`edge.haproxy_enabled`) and enforced by HAProxy's per-src stick-table.
 */
export function extractRemoteIp(socket: Socket): string {
  const fromHandshake = socket.handshake.address;
  return typeof fromHandshake === 'string' && fromHandshake.length > 0
    ? fromHandshake
    : UNKNOWN_REMOTE_IP;
}
