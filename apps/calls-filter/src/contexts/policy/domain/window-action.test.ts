import { ALWAYS_BLOCK, ALWAYS_PASS } from './policy';
import { windowActionOf } from './window-action';

describe('the action of a group while its conditions hold', () => {
  it('is the opposite of what the group does the rest of the time', () => {
    expect(windowActionOf(ALWAYS_BLOCK)).toBe('pass');
    expect(windowActionOf(ALWAYS_PASS)).toBe('block');
  });
});
