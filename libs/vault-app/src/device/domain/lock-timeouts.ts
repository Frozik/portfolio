import type { Milliseconds } from '@frozik/utils/date/types';

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
