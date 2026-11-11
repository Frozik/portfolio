import { Temporal } from 'temporal-polyfill';

/** How many days apart the vault is written to the backup folder; `null` never. */
export const BACKUP_INTERVALS = [null, 2, 7, 14, 28] as const;

export type TBackupInterval = (typeof BACKUP_INTERVALS)[number];

/** A copy a week: on by default, since a phone that is lost or reset takes its only copy with it. */
export const DEFAULT_BACKUP_INTERVAL: TBackupInterval = 7;

/** A stored number that is no longer offered is read as the default. */
export function backupIntervalOf(days: number | null): TBackupInterval {
  return BACKUP_INTERVALS.find(interval => interval === days) ?? DEFAULT_BACKUP_INTERVAL;
}

/** Whether the next copy is due: never with no interval, at once with none made yet. */
export function isBackupDue(
  interval: TBackupInterval,
  lastBackupAt: number | null,
  now: number
): boolean {
  if (interval === null) {
    return false;
  }
  if (lastBackupAt === null) {
    return true;
  }
  return (
    now - lastBackupAt >= Temporal.Duration.from({ days: interval }).total({ unit: 'milliseconds' })
  );
}
