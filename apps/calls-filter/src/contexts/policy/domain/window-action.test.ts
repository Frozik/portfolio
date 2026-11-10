import { ALWAYS_BLOCK, ALWAYS_PASS } from './policy';
import { windowActionOf, withWindowAction } from './window-action';

const SCHEDULED = {
  ...ALWAYS_BLOCK,
  scheduled: { action: 'block' as const, schedule: null, calendars: [], places: [] },
};

describe('the action of a group while its conditions hold', () => {
  it('starts as the other thing from what the group usually does', () => {
    expect(windowActionOf(ALWAYS_BLOCK)).toBe('pass');
    expect(windowActionOf(ALWAYS_PASS)).toBe('block');
  });

  it('is what the group set once it has conditions', () => {
    expect(windowActionOf(SCHEDULED)).toBe('block');
    expect(windowActionOf(withWindowAction(SCHEDULED, 'pass'))).toBe('pass');
  });

  it('is nothing to set while the group has no conditions', () => {
    expect(withWindowAction(ALWAYS_BLOCK, 'pass')).toBe(ALWAYS_BLOCK);
  });
});
