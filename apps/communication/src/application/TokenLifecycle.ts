import { Temporal } from 'temporal-polyfill';
import type { TokenClaims } from '../domain/Identity';

const SECONDS_TO_MS = 1_000;
/**
 * Largest delay `setTimeout` will accept without falling back to
 * "fire immediately" behaviour (Node, Chrome and Firefox all clamp
 * here). Equals 2^31-1 ms ≈ 24.8 days. Tokens with longer TTLs
 * (Yandex' `/info?format=jwt` JWTs are valid for a year) need to be
 * scheduled in chained chunks — otherwise both the warning and the
 * expiry timer fire in the same event loop tick as `arm()` and the
 * server promptly kicks the client with `auth/expired`.
 */
const MAX_SAFE_TIMEOUT_MS = 2_147_483_647;

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

    this.scheduleSafeTimeout(
      warningDelayMs,
      () => {
        if (armedGeneration !== this.generation) {
          return;
        }
        callbacks.onWarning(this.deps.warningSeconds);
      },
      timer => {
        this.warningTimer = timer;
      }
    );

    this.scheduleSafeTimeout(
      expiryDelayMs,
      () => {
        if (armedGeneration !== this.generation) {
          return;
        }
        callbacks.onExpired();
      },
      timer => {
        this.expiryTimer = timer;
      }
    );
  }

  /**
   * `setTimeout` with chunked re-arm so delays > 2^31-1 ms work as
   * intended (browsers and Node both clamp huge delays to 1 ms,
   * firing the callback instantly). Each leg of the chain stores its
   * handle via `store` so `disarm()` always has a live handle to
   * `clearTimeout` against — generation guards in the user-facing
   * callback are an additional safety net.
   */
  private scheduleSafeTimeout(
    delayMs: number,
    callback: () => void,
    store: (timer: ReturnType<typeof setTimeout>) => void
  ): void {
    if (delayMs <= MAX_SAFE_TIMEOUT_MS) {
      store(setTimeout(callback, delayMs));
      return;
    }
    store(
      setTimeout(() => {
        this.scheduleSafeTimeout(delayMs - MAX_SAFE_TIMEOUT_MS, callback, store);
      }, MAX_SAFE_TIMEOUT_MS)
    );
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
