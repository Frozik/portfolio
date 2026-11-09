import { adb } from '@frozik/tooling/src/android-e2e/device.ts';

const PROVIDER = 'content://com.android.calendar';
const MINUTE_MS = 60_000;

/** A calendar of a local account, as one of a Google account would be: the emulator has none. */
export const WORK_CALENDAR = {
  accountType: 'LOCAL',
  accountName: 'e2e@example.com',
  calendarName: 'Work',
} as const;

const asSyncAdapter = `caller_is_syncadapter=true&account_name=${WORK_CALENDAR.accountName}&account_type=${WORK_CALENDAR.accountType}`;
const ownCalendars = `account_name='${WORK_CALENDAR.accountName}'`;

async function workCalendarId(): Promise<string | null> {
  const rows = await adb(
    'shell',
    `content query --uri '${PROVIDER}/calendars' --projection _id --where "${ownCalendars}"`
  );
  return /_id=(\d+)/.exec(rows)?.[1] ?? null;
}

/** The «Work» calendar, created once per emulator and found again afterwards. */
export async function ensureWorkCalendar(): Promise<string> {
  const existing = await workCalendarId();
  if (existing !== null) {
    return existing;
  }
  await adb(
    'shell',
    [
      `content insert --uri '${PROVIDER}/calendars?${asSyncAdapter}'`,
      `--bind account_name:s:${WORK_CALENDAR.accountName}`,
      `--bind account_type:s:${WORK_CALENDAR.accountType}`,
      `--bind name:s:${WORK_CALENDAR.calendarName}`,
      `--bind calendar_displayName:s:${WORK_CALENDAR.calendarName}`,
      '--bind calendar_color:i:-14575885',
      '--bind calendar_access_level:i:700',
      `--bind ownerAccount:s:${WORK_CALENDAR.accountName}`,
      '--bind visible:i:1',
      '--bind sync_events:i:1',
    ].join(' ')
  );
  const created = await workCalendarId();
  if (created === null) {
    throw new Error('The calendar provider did not keep the «Work» calendar');
  }
  return created;
}

/** A meeting in «Work» from a few minutes ago until `minutes` from now, by the phone's own clock. */
export async function meetingNow(
  calendarId: string,
  title: string,
  minutes: number
): Promise<void> {
  const now = Number((await adb('shell', 'date', '+%s')).trim()) * 1000;
  await adb(
    'shell',
    [
      `content insert --uri '${PROVIDER}/events'`,
      `--bind calendar_id:l:${calendarId}`,
      `--bind title:s:${title}`,
      `--bind dtstart:l:${now - 5 * MINUTE_MS}`,
      `--bind dtend:l:${now + minutes * MINUTE_MS}`,
      '--bind eventTimezone:s:UTC',
    ].join(' ')
  );
}

export async function clearMeetings(calendarId: string): Promise<void> {
  await adb(
    'shell',
    `content delete --uri '${PROVIDER}/events' --where "calendar_id=${calendarId}"`
  );
}
