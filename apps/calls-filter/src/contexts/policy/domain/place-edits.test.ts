import { withoutPlace, withPlace } from './place-edits';
import type { IPlaceRule, TPlaceId } from './place-rule';
import { ALWAYS_BLOCK } from './policy';

const office: IPlaceRule = {
  id: 'office' as TPlaceId,
  name: 'Office',
  latitude: 52.37,
  longitude: 4.89,
  radius: 500,
  mode: 'only-at',
};

describe('editing the places of a policy', () => {
  it('gives a group the place it is given', () => {
    const policy = withPlace(ALWAYS_BLOCK, office);
    expect(policy.conditions?.places).toEqual([office]);
  });

  it('replaces a place edited again instead of adding it twice', () => {
    const moved = { ...office, radius: 1_000 as const };
    expect(withPlace(withPlace(ALWAYS_BLOCK, office), moved).conditions?.places).toEqual([moved]);
  });

  it('drops the conditions once their last place is gone and nothing else narrows them', () => {
    expect(withoutPlace(withPlace(ALWAYS_BLOCK, office), office.id).conditions).toBeNull();
  });
});
