import type { TPlaceId, TPlaceRadius } from './place-rule';
import { ALWAYS_BLOCK, ALWAYS_PASS, withConditions } from './policy';

const NOWHERE = { schedule: null, calendars: [], places: [] };
const AT_OFFICE = {
  ...NOWHERE,
  places: [
    {
      id: 'office' as TPlaceId,
      name: 'Office',
      latitude: 52.37,
      longitude: 4.9,
      radius: 500 as TPlaceRadius,
      mode: 'only-at' as const,
    },
  ],
};

describe('a group given conditions', () => {
  it('keeps what it does, now only while they hold', () => {
    expect(withConditions(ALWAYS_BLOCK, AT_OFFICE)).toEqual({
      ...ALWAYS_BLOCK,
      conditions: AT_OFFICE,
    });
  });

  it('is in force always again once its last condition goes', () => {
    expect(withConditions(withConditions(ALWAYS_PASS, AT_OFFICE), NOWHERE)).toEqual(ALWAYS_PASS);
  });
});
