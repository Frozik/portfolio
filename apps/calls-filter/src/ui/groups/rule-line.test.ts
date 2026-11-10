import { Temporal } from 'temporal-polyfill';

import type { IActivityNow } from '../../contexts/policy/domain/activity-now';
import { floatingMinute } from '../../contexts/policy/domain/floating-time';
import { EN } from '../../texts/en';
import { ruleLine } from './rule-line';

const TODAY = Temporal.PlainDate.from('2026-11-09');

function endingAt(activity: IActivityNow['activity'], local: string): IActivityNow {
  return { activity, changesAt: floatingMinute(Temporal.PlainDateTime.from(local)) };
}

describe('the line under a group in the list', () => {
  it('says until when the rule works today, by the time alone', () => {
    expect(ruleLine(EN, endingAt('conditions-hold', '2026-11-09T21:11'), TODAY)).toBe(
      'Active until 21:11'
    );
  });

  it('says from when a waiting rule starts: the weekday in the coming week', () => {
    expect(ruleLine(EN, endingAt('conditions-unmet', '2026-11-11T09:00'), TODAY)).toBe(
      'Active from Wed 09:00'
    );
  });

  it('names the date once a weekday could mean two days', () => {
    expect(ruleLine(EN, endingAt('conditions-unmet', '2026-11-18T09:00'), TODAY)).toBe(
      'Active from 18 Nov, 09:00'
    );
  });

  it('says nothing when nothing is going to change', () => {
    expect(ruleLine(EN, { activity: 'always', changesAt: null }, TODAY)).toBeNull();
  });
});
