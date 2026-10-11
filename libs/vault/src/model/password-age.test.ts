import { Temporal } from 'temporal-polyfill';

import { aCardWith, aField, anHlc } from '../testing/builders';
import { MS_PER_DAY, rotationDueOn, rotationStatus } from './password-age';

const NOW_MS = Temporal.Instant.from('2026-10-11T12:00:00Z').epochMilliseconds;
const TODAY = Temporal.PlainDate.from('2026-10-11');

function aLoginSetDaysAgo(days: number, rotateEveryDays: number | null) {
  const at = anHlc(NOW_MS - days * MS_PER_DAY);
  return aCardWith([aField({ kind: 'password', rotateEveryDays }, 'a-long-password')], {
    createdAt: at,
    updatedAt: at,
  });
}

describe('a password period', () => {
  it('falls due the set number of days after the password was last changed', () => {
    expect(rotationDueOn(aLoginSetDaysAgo(10, 90), TODAY, NOW_MS)?.toString()).toBe('2026-12-30');
  });

  it('is not due at all when no field sets one', () => {
    expect(rotationDueOn(aLoginSetDaysAgo(400, null), TODAY, NOW_MS)).toBeNull();
  });

  it('is announced a week ahead and called overdue once past, like an expiry', () => {
    const status = (days: number) =>
      rotationStatus(rotationDueOn(aLoginSetDaysAgo(days, 30), TODAY, NOW_MS), TODAY);

    expect([status(10), status(23), status(30), status(31)]).toEqual([
      'ok',
      'soon',
      'soon',
      'expired',
    ]);
  });
});
