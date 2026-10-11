import type { Milliseconds } from '@frozik/utils/date/types';

import type { ILockTimeouts } from './lock-deadline';
import { DEFAULT_LOCK_TIMEOUTS } from './lock-deadline';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

/** What this device chose for this vault; never synchronised. */
export interface IDeviceSettings {
  readonly lock: ILockTimeouts;
  readonly clipboardClearMs: Milliseconds;
  /** Look passwords up in Have I Been Pwned (by a hash prefix); off until chosen. */
  readonly checkLeaks: boolean;
  /** Ask an icon service for each site's icon, once per domain; on unless turned off. */
  readonly loadSiteIcons: boolean;
}

export const DEFAULT_DEVICE_SETTINGS: IDeviceSettings = {
  lock: DEFAULT_LOCK_TIMEOUTS,
  clipboardClearMs: (30 * SECOND_MS) as Milliseconds,
  checkLeaks: false,
  loadSiteIcons: true,
};

/** The choices the settings offer. */
export const IDLE_LOCK_CHOICES: readonly Milliseconds[] = [1, 5, 15, 60].map(
  minutes => (minutes * MINUTE_MS) as Milliseconds
);

/** `0` locks a hidden tab at once, `null` never. */
export const HIDDEN_LOCK_CHOICES: readonly (Milliseconds | null)[] = [
  0 as Milliseconds,
  MINUTE_MS as Milliseconds,
  (5 * MINUTE_MS) as Milliseconds,
  null,
];

export const CLIPBOARD_CLEAR_CHOICES: readonly Milliseconds[] = [10, 30, 60].map(
  seconds => (seconds * SECOND_MS) as Milliseconds
);
