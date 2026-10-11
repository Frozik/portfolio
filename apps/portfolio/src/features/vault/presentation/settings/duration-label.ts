import { settingsT } from '../translations/settings';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

/** A timeout choice in words: `0` is "at once", `null` "never". */
export function durationLabel(ms: number | null): string {
  const t = settingsT;
  if (ms === null) {
    return t.never;
  }
  if (ms === 0) {
    return t.atOnce;
  }
  if (ms % HOUR_MS === 0) {
    return t.hours(ms / HOUR_MS);
  }
  return ms % MINUTE_MS === 0 ? t.minutes(ms / MINUTE_MS) : t.seconds(ms / SECOND_MS);
}
