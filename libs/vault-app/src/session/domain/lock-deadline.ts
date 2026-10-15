import { isNil } from 'lodash-es';
import type { TLockReason } from './lifecycle-state';

import type { ILockTimeouts } from '../../device/domain/lock-timeouts';

const MINUTE_MS = 60_000;

/** How often the deadline is checked, and the gap between checks that means the system slept. */
export const LOCK_CHECK_INTERVAL_MS = 15_000;
const SLEEP_GAP_MS = MINUTE_MS;

/** Epoch milliseconds of the last user activity and of the moment the tab was hidden. */
export interface IActivity {
  readonly lastActivityAt: number;
  readonly hiddenSince: number | null;
}

export type TSignalledLock = Extract<TLockReason, 'idle' | 'concealed' | 'sleep'>;

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
    return 'concealed';
  }
  if (now - activity.lastActivityAt < timeouts.idle) {
    return null;
  }
  return now - lastCheckAt > SLEEP_GAP_MS ? 'sleep' : 'idle';
}
