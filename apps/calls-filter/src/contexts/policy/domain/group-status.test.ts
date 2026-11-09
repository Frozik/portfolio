import { Temporal } from 'temporal-polyfill';

import { floatingMinute } from './floating-time';
import { groupStatus } from './group-status';
import { NOWHERE_KNOWN } from './place-rule';
import type { IPolicy, ITemporaryPolicy } from './policy';
import { REPEAT_OFF } from './repeat-pass';
import { normalizeWindows } from './window-set';

const ZONE = 'Europe/Amsterdam';

const local = (text: string) => {
  const dateTime = Temporal.PlainDateTime.from(text);
  return { instant: dateTime.toZonedDateTime(ZONE).toInstant(), local: floatingMinute(dateTime) };
};

const minute = (text: string) => floatingMinute(Temporal.PlainDateTime.from(text));

const DAYTIME_PASS: IPolicy = {
  otherwise: 'block',
  scheduled: {
    action: 'pass',
    schedule: null,
    calendars: [],
    places: [],
  },
  repeatPass: REPEAT_OFF,
  repeatWindowMinutes: 5,
};

const DAYTIME = normalizeWindows([
  { from: minute('2026-11-03T09:00'), to: minute('2026-11-03T18:00') },
]);

describe('what a group does now, and after that changes', () => {
  it('passes until the window closes, then blocks', () => {
    const status = groupStatus(
      { policy: DAYTIME_PASS, temporary: null },
      local('2026-11-03T10:00'),
      DAYTIME,
      NOWHERE_KNOWN
    );
    expect(status.now).toMatchObject({ action: 'pass', source: 'scheduled' });
    expect(status.next).toMatchObject({ action: 'block', source: 'otherwise' });
  });

  it('tells what follows a temporary policy: the schedule, as of the moment it ends', () => {
    const temporary: ITemporaryPolicy = {
      action: 'block',
      until: { kind: 'instant', at: local('2026-11-03T10:30').instant },
      setAt: local('2026-11-03T09:30').instant,
    };
    const status = groupStatus(
      { policy: DAYTIME_PASS, temporary },
      local('2026-11-03T10:00'),
      DAYTIME,
      NOWHERE_KNOWN
    );
    expect(status.now).toMatchObject({ action: 'block', source: 'temporary' });
    expect(status.next).toMatchObject({ action: 'pass', source: 'scheduled' });
  });

  it('has nothing next when nothing ever changes', () => {
    const status = groupStatus(
      { policy: { ...DAYTIME_PASS, scheduled: null }, temporary: null },
      local('2026-11-03T10:00'),
      null,
      NOWHERE_KNOWN
    );
    expect(status.next).toBeNull();
  });
});
