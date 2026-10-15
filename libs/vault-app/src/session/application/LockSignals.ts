import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';
import type { TLockReason } from '../domain/lifecycle-state';

import type { ILockTimeouts } from '../../device/domain/lock-timeouts';
import type { IActivity } from '../domain/lock-deadline';
import { dueLock, LOCK_CHECK_INTERVAL_MS } from '../domain/lock-deadline';
import type { ILockSignalSource } from '../domain/ports/lock-signal-source';
import type { ISessionClock } from '../domain/ports/session-clock';

export type TSignalLock = Extract<
  TLockReason,
  'idle' | 'concealed' | 'sleep' | 'unloading' | 'resumed'
>;

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
    signals: ILockSignalSource,
    private readonly clock: ISessionClock,
    private readonly timeouts: ILockTimeouts,
    private readonly onLock: (reason: TSignalLock) => void
  ) {
    const now = clock.now();
    this.activity = { lastActivityAt: now, hiddenSince: signals.isConcealed() ? now : null };
    this.lastCheckAt = now;

    this.bag.add(
      signals.onActivity(() => {
        this.activity = { ...this.activity, lastActivityAt: this.clock.now() };
      })
    );
    this.bag.add(signals.onConcealed(hidden => this.visibilityChanged(hidden)));
    this.bag.add(signals.onUnloading(() => this.lock('unloading')));
    this.bag.add(signals.onResumedFromSuspend(() => this.lock('resumed')));
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

  private lock(reason: TSignalLock): void {
    if (this.fired) {
      return;
    }
    this.fired = true;
    this.dispose();
    this.onLock(reason);
  }
}
