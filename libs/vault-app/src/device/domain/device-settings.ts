import type { Milliseconds } from '@frozik/utils/date/types';

import type { IQuickUnlockSetting } from '../../keys/domain/quick-code';
import type { ILockTimeouts } from './lock-timeouts';
import { DEFAULT_LOCK_TIMEOUTS } from './lock-timeouts';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

const DEFAULT_BACKUPS_KEPT = 10;

/** What this device chose for this vault; never synchronised. */
export interface IDeviceSettings {
  readonly lock: ILockTimeouts;
  readonly clipboardClearMs: Milliseconds;
  /** Look passwords up in Have I Been Pwned (by a hash prefix); off until chosen. */
  readonly checkLeaks: boolean;
  /** Ask an icon service for each site's icon, once per domain; on unless turned off. */
  readonly loadSiteIcons: boolean;
  /** How many earlier versions of the vault this device keeps to roll back to. */
  readonly backupsKept: number;
  /** A short code that opens an idle or concealed lock once; `null` until set up. */
  readonly quickUnlock: IQuickUnlockSetting | null;
  /** When the master password was last typed on this device; the reminder counts from it. */
  readonly lastMasterAt: Milliseconds | null;
  /** A phone lets the open vault be captured (screenshots, recording, the recents picture); off until confirmed. */
  readonly allowScreenshots: boolean;
}

export const DEFAULT_DEVICE_SETTINGS: IDeviceSettings = {
  lock: DEFAULT_LOCK_TIMEOUTS,
  clipboardClearMs: (30 * SECOND_MS) as Milliseconds,
  checkLeaks: false,
  loadSiteIcons: true,
  backupsKept: DEFAULT_BACKUPS_KEPT,
  quickUnlock: null,
  lastMasterAt: null,
  allowScreenshots: false,
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

/** Each backup is a whole sealed copy of the vault, its files included. */
export const BACKUPS_KEPT_CHOICES: readonly number[] = [5, DEFAULT_BACKUPS_KEPT, 30, 100];

export const CLIPBOARD_CLEAR_CHOICES: readonly Milliseconds[] = [10, 30, 60].map(
  seconds => (seconds * SECOND_MS) as Milliseconds
);
