import type { Milliseconds } from '@frozik/utils/date/types';
import type { TLockReason } from '@frozik/vault/lifecycle/lifecycle-state';
import { isNil } from 'lodash-es';

const MINUTE_MS = 60_000;

/** `hidden: null` never locks a hidden tab; `0` locks it at once. */
export interface ILockTimeouts {
  readonly idle: Milliseconds;
  readonly hidden: Milliseconds | null;
}

export const DEFAULT_LOCK_TIMEOUTS: ILockTimeouts = {
  idle: (5 * MINUTE_MS) as Milliseconds,
  hidden: MINUTE_MS as Milliseconds,
};

/** How often the deadline is checked, and the gap between checks that means the system slept. */
export const LOCK_CHECK_INTERVAL_MS = 15_000;
const SLEEP_GAP_MS = MINUTE_MS;

/** Epoch milliseconds of the last user activity and of the moment the tab was hidden. */
export interface IActivity {
  readonly lastActivityAt: number;
  readonly hiddenSince: number | null;
}

export type TSignalledLock = Extract<TLockReason, 'idle' | 'hidden' | 'sleep'>;

/**
 * Deadlines are read off the wall clock, never counted by
 * timers: a sleeping laptop fires no timers, and a throttled background tab
 * fires them late. A deadline found passed after a long gap since the last
 * check is reported as sleep.
 */
export function dueLock(
  activity: IActivity,
  timeouts: ILockTimeouts,
  now: number,
  lastCheckAt: number
): TSignalledLock | null {
  if (
    !isNil(activity.hiddenSince) &&
    !isNil(timeouts.hidden) &&
    now - activity.hiddenSince >= timeouts.hidden
  ) {
    return 'hidden';
  }
  if (now - activity.lastActivityAt < timeouts.idle) {
    return null;
  }
  return now - lastCheckAt > SLEEP_GAP_MS ? 'sleep' : 'idle';
}
