import type { Milliseconds } from '@frozik/utils/date/types';
import { isNil } from 'lodash-es';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The master password is asked for again after this long without being typed. */
export const REMINDER_INTERVAL_MS = (7 * DAY_MS) as Milliseconds;

/**
 * Whether an unlock without the master password (a quick code, biometrics,
 * a passkey) should remind the user to type it. Before it was ever recorded
 * on this device there is nothing to count from.
 */
export function reminderDue(lastMasterAt: Milliseconds | null, now: number): boolean {
  return !isNil(lastMasterAt) && now - lastMasterAt >= REMINDER_INTERVAL_MS;
}
