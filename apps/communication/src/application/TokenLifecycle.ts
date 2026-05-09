import { Temporal } from 'temporal-polyfill';
import type { TokenClaims } from '../domain/Identity';

const SECONDS_TO_MS = 1_000;

export type TokenLifecycleCallbacks = {
  onWarning(secondsRemaining: number): void;
  onExpired(): void;
};

type TokenLifecycleDeps = {
  warningSeconds: number;
};

export class TokenLifecycle {
  // Generation guard — every `arm` call increments the generation, and
  // captured timers compare their generation against the current one to
  // avoid firing callbacks for cancelled schedules. This is more robust
  // than relying on `clearTimeout` alone (e.g. timers already in the
  // microtask queue).
  private generation = 0;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(private readonly deps: TokenLifecycleDeps) {}

  public arm(claims: TokenClaims, callbacks: TokenLifecycleCallbacks): void {
    this.disarm();
    this.generation += 1;
    const armedGeneration = this.generation;

    const nowMs = Temporal.Now.instant().epochMilliseconds;
    const expiryMs = claims.exp;
    const warningOffsetMs = this.deps.warningSeconds * SECONDS_TO_MS;
    const warningDelayMs = Math.max(0, expiryMs - warningOffsetMs - nowMs);
    const expiryDelayMs = Math.max(0, expiryMs - nowMs);

    this.warningTimer = setTimeout(() => {
      if (armedGeneration !== this.generation) {
        return;
      }
      callbacks.onWarning(this.deps.warningSeconds);
    }, warningDelayMs);

    this.expiryTimer = setTimeout(() => {
      if (armedGeneration !== this.generation) {
        return;
      }
      callbacks.onExpired();
    }, expiryDelayMs);
  }

  public replaceClaims(newClaims: TokenClaims, callbacks: TokenLifecycleCallbacks): void {
    this.arm(newClaims, callbacks);
  }

  public disarm(): void {
    if (this.warningTimer !== null) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  public dispose(): void {
    this.disarm();
  }
}
