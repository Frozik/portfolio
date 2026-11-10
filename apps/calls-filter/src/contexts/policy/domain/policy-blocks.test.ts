import { ALWAYS_BLOCK, ALWAYS_PASS, everBlocks } from './policy';

describe('whether a group ever turns a call away', () => {
  it('does when it blocks the rest of the time', () => {
    expect(everBlocks(ALWAYS_BLOCK)).toBe(true);
  });

  it('does when it lets calls through but blocks while its conditions hold', () => {
    expect(
      everBlocks({ ...ALWAYS_PASS, scheduled: { schedule: null, calendars: [], places: [] } })
    ).toBe(true);
  });

  it('never does when it always lets calls through', () => {
    expect(everBlocks(ALWAYS_PASS)).toBe(false);
  });
});
