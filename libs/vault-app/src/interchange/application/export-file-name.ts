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

/** A copy for the backup folder: the export's name and the minute, so copies of one day sit apart. */
export function backupFileName(vaultName: string, now: number): string {
  const time = Temporal.Instant.fromEpochMilliseconds(now)
    .toZonedDateTimeISO(Temporal.Now.timeZoneId())
    .toPlainTime();
  const clock = [time.hour, time.minute].map(part => String(part).padStart(2, '0')).join('-');
  return `${exportBaseName(vaultName, now)} ${clock}.pwv`;
}
