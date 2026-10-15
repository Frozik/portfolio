import { Temporal } from 'temporal-polyfill';

const UNSAFE_FILE_NAME = /[\\/:*?"<>|]+/g;

/** A file the vault leaves as: its name made safe for any file system, and the day it was made. */
export function exportBaseName(vaultName: string, now: number): string {
  const day = Temporal.Instant.fromEpochMilliseconds(now)
    .toZonedDateTimeISO(Temporal.Now.timeZoneId())
    .toPlainDate();
  const name = vaultName.replaceAll(UNSAFE_FILE_NAME, '-').trim() || 'vault';
  return `${name} ${day.toString()}`;
}
