import { Temporal } from 'temporal-polyfill';

import { floatingMinute } from './floating-time';
import { windowsOnPhoneClock } from './zone-shift';

const at = (text: string) => floatingMinute(Temporal.PlainDateTime.from(text));
const WORK = [{ from: at('2026-11-09T09:00'), to: at('2026-11-09T18:00') }];

describe("a schedule read on the phone's clock", () => {
  it('keeps its own zone: work 9–18 in Amsterdam is 10–19 in Helsinki', () => {
    expect(
      windowsOnPhoneClock(WORK, { kind: 'fixed', zone: 'Europe/Amsterdam' }, 'Europe/Helsinki')
    ).toEqual([{ from: at('2026-11-09T10:00'), to: at('2026-11-09T19:00') }]);
  });

  it('follows the phone when it is «where I am»', () => {
    expect(windowsOnPhoneClock(WORK, { kind: 'here' }, 'Europe/Helsinki')).toEqual(WORK);
  });
});
