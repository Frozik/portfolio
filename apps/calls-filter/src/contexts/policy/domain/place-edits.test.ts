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
  it('lets a blocking group through at a place it is given', () => {
    const policy = withPlace(ALWAYS_BLOCK, office);
    expect(policy.scheduled?.action).toBe('pass');
    expect(policy.scheduled?.places).toEqual([office]);
  });

  it('replaces a place edited again instead of adding it twice', () => {
    const moved = { ...office, radius: 1_000 as const };
    expect(withPlace(withPlace(ALWAYS_BLOCK, office), moved).scheduled?.places).toEqual([moved]);
  });

  it('drops the scheduled action once its last place is gone and nothing else narrows it', () => {
    expect(withoutPlace(withPlace(ALWAYS_BLOCK, office), office.id).scheduled).toBeNull();
  });
});
