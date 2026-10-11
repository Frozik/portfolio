import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';
import type { TLockReason } from '@frozik/vault/lifecycle/lifecycle-state';

import type { IActivity, ILockTimeouts } from '../domain/lock-deadline';
import { dueLock, LOCK_CHECK_INTERVAL_MS } from '../domain/lock-deadline';
import type { IPageSignals } from '../domain/ports/page-signals';
import type { ISessionClock } from '../domain/ports/session-clock';

export type TPageLock = Extract<TLockReason, 'idle' | 'hidden' | 'sleep' | 'pagehide' | 'bfcache'>;

/**
 * Turns what the page reports into one lock request. It
 * fires once: a session locks once, and the next session starts new signals.
 */
export class LockSignals {
  private readonly bag = new DisposableBag();
  private activity: IActivity;
  private lastCheckAt: number;
  private fired = false;

  constructor(
    page: IPageSignals,
    private readonly clock: ISessionClock,
    private readonly timeouts: ILockTimeouts,
    private readonly onLock: (reason: TPageLock) => void
  ) {
    const now = clock.now();
    this.activity = { lastActivityAt: now, hiddenSince: page.isHidden() ? now : null };
    this.lastCheckAt = now;

    this.bag.add(
      page.onActivity(() => {
        this.activity = { ...this.activity, lastActivityAt: this.clock.now() };
      })
    );
    this.bag.add(page.onVisibilityChange(hidden => this.visibilityChanged(hidden)));
    this.bag.add(page.onPageHide(() => this.lock('pagehide')));
    this.bag.add(page.onRestoredFromCache(() => this.lock('bfcache')));
    this.bag.add(clock.every(LOCK_CHECK_INTERVAL_MS, () => this.check()));
  }

  dispose(): void {
    this.bag.disposeAll();
  }

  private visibilityChanged(hidden: boolean): void {
    this.check();
    const now = this.clock.now();
    this.activity = hidden
      ? { ...this.activity, hiddenSince: now }
      : { lastActivityAt: now, hiddenSince: null };
    this.check();
  }

  private check(): void {
    const now = this.clock.now();
    const reason = dueLock(this.activity, this.timeouts, now, this.lastCheckAt);
    this.lastCheckAt = now;
    if (reason !== null) {
      this.lock(reason);
    }
  }

  private lock(reason: TPageLock): void {
    if (this.fired) {
      return;
    }
    this.fired = true;
    this.dispose();
    this.onLock(reason);
  }
}
