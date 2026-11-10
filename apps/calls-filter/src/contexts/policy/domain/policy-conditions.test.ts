import { actionOf, ALWAYS_BLOCK, ALWAYS_PASS, withAction, withConditions } from './policy';

const NOWHERE = { schedule: null, calendars: [], places: [] };
const AT_OFFICE = {
  ...NOWHERE,
  places: [
    {
      id: 'office' as never,
      name: 'Office',
      latitude: 52.37,
      longitude: 4.9,
      radius: 500 as never,
      mode: 'only-at' as const,
    },
  ],
};

describe('what a group is set to do, and its conditions', () => {
  it('is what it does always while it has no conditions', () => {
    expect(actionOf(ALWAYS_BLOCK)).toBe('block');
    expect(actionOf(ALWAYS_PASS)).toBe('pass');
  });

  it('keeps blocking while its first condition holds, and lets calls through the rest of the time', () => {
    const atOffice = withConditions(ALWAYS_BLOCK, AT_OFFICE);
    expect(actionOf(atOffice)).toBe('block');
    expect(atOffice.otherwise).toBe('pass');
  });

  it('does always what it was set to once its last condition goes', () => {
    const atOffice = withConditions(ALWAYS_PASS, AT_OFFICE);
    expect(withConditions(atOffice, NOWHERE)).toEqual(ALWAYS_PASS);
  });

  it('sets what it does while its conditions hold, the opposite the rest of the time', () => {
    const letThrough = withAction(withConditions(ALWAYS_BLOCK, AT_OFFICE), 'pass');
    expect(actionOf(letThrough)).toBe('pass');
    expect(letThrough.otherwise).toBe('block');
  });
});
