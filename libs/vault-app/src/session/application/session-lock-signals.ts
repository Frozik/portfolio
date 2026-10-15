import { reaction } from 'mobx';

import type { ILockTimeouts } from '../../device/domain/lock-timeouts';
import type { TLockReason } from '../domain/lifecycle-state';
import type { ILockSignalSource } from '../domain/ports/lock-signal-source';
import type { ISessionClock } from '../domain/ports/session-clock';
import { LockSignals } from './LockSignals';

/** The platform's lock signals under the device's current timeouts, followed as they change; returns the stop. */
export function followLockSignals({
  signals,
  clock,
  timeouts,
  onLock,
}: {
  readonly signals: ILockSignalSource;
  readonly clock: ISessionClock;
  readonly timeouts: () => ILockTimeouts;
  readonly onLock: (reason: TLockReason) => void;
}): () => void {
  let watching = new LockSignals(signals, clock, timeouts(), onLock);
  const stopFollowing = reaction(timeouts, next => {
    watching.dispose();
    watching = new LockSignals(signals, clock, next, onLock);
  });
  return () => {
    stopFollowing();
    watching.dispose();
  };
}
