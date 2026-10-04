import type { Result } from '../../domain/Result';
import { err, ok } from '../../domain/Result';

export interface EchoQuota {
  readonly concurrentPerIp: number;
  readonly concurrentTotal: number;
  readonly bytesPerIpPerHour: number;
}

export type EchoRefusal = 'server-busy' | 'too-many-concurrent' | 'hourly-quota';

export interface EchoTicket {
  /** Frees the concurrency slot; the bytes stay counted against the hour. */
  release(): void;
}

interface Reservation {
  readonly atMs: number;
  readonly bytes: number;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Who may start an echo right now. The file size declared up front is
 * reserved against the IP's hourly budget, so a refused request costs nothing
 * and an accepted one can never exceed what was reserved.
 */
export class EchoAdmission {
  private readonly running = new Map<string, number>();
  private readonly reservations = new Map<string, Reservation[]>();
  private runningTotal = 0;

  constructor(
    private readonly quota: EchoQuota,
    private readonly nowMs: () => number
  ) {}

  /**
   * `ip` is undefined when the address is not the client's own (the fallback
   * behind a TCP proxy): such calls answer only to the server-wide cap, rather
   * than all sharing one address's quota.
   */
  admit(ip: string | undefined, declaredBytes: number): Result<EchoTicket, EchoRefusal> {
    if (this.runningTotal >= this.quota.concurrentTotal) {
      return err('server-busy');
    }
    const now = this.nowMs();
    this.forgetExpired(now);
    if (ip === undefined) {
      return ok(this.ticket(undefined));
    }
    if ((this.running.get(ip) ?? 0) >= this.quota.concurrentPerIp) {
      return err('too-many-concurrent');
    }
    const recent = this.reservations.get(ip) ?? [];
    const used = recent.reduce((sum, reservation) => sum + reservation.bytes, 0);
    if (used + declaredBytes > this.quota.bytesPerIpPerHour) {
      return err('hourly-quota');
    }
    this.reservations.set(ip, [...recent, { atMs: now, bytes: declaredBytes }]);
    this.running.set(ip, (this.running.get(ip) ?? 0) + 1);
    return ok(this.ticket(ip));
  }

  private ticket(ip: string | undefined): EchoTicket {
    this.runningTotal += 1;
    let isReleased = false;
    return {
      release: () => {
        if (isReleased) {
          return;
        }
        isReleased = true;
        this.runningTotal -= 1;
        if (ip === undefined) {
          return;
        }
        const remaining = (this.running.get(ip) ?? 1) - 1;
        if (remaining === 0) {
          this.running.delete(ip);
        } else {
          this.running.set(ip, remaining);
        }
      },
    };
  }

  /** Every address's reservations age out, including addresses that never come back. */
  private forgetExpired(now: number): void {
    for (const [ip, reservations] of this.reservations) {
      const recent = reservations.filter(reservation => now - reservation.atMs < HOUR_MS);
      if (recent.length === 0) {
        this.reservations.delete(ip);
      } else if (recent.length !== reservations.length) {
        this.reservations.set(ip, recent);
      }
    }
  }
}
