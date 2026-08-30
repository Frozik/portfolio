import { Temporal } from 'temporal-polyfill';

/**
 * Whether the string names a time zone the runtime knows. The IANA database
 * belongs to the platform rather than to us, so asking it to resolve the name is
 * the only honest validation — and a rejected name arrives as a throw, which is
 * why this is the one place that catches one.
 */
export function isValidTimeZoneId(timeZoneId: string): boolean {
  try {
    Temporal.Now.zonedDateTimeISO(timeZoneId);

    return true;
  } catch {
    return false;
  }
}
