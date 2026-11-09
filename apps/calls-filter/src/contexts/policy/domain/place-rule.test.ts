import type { IPlaceRule, TPlaceId } from './place-rule';
import { distanceMeters, placesAllow } from './place-rule';

const office: IPlaceRule = {
  id: 'office' as TPlaceId,
  name: 'Office',
  latitude: 52.37,
  longitude: 4.89,
  radius: 500,
  mode: 'only-at',
};
const home: IPlaceRule = { ...office, id: 'home' as TPlaceId, name: 'Home', mode: 'except-at' };

describe('where the phone is, in a rule', () => {
  it('lets «only at the office» apply at the office, not elsewhere', () => {
    expect(placesAllow([office], () => true)).toBe(true);
    expect(placesAllow([office], () => false)).toBe(false);
  });

  it('lets «except at home» apply anywhere but home', () => {
    expect(placesAllow([home], () => false)).toBe(true);
    expect(placesAllow([home], () => true)).toBe(false);
  });

  it('leaves the decision to the schedule and calendars while the location is unknown', () => {
    expect(placesAllow([office, home], () => null)).toBe(true);
  });
});

describe('the distance between two points', () => {
  it('measures Amsterdam Centraal to the Dam as about 750 m', () => {
    const distance = distanceMeters(
      { latitude: 52.3791, longitude: 4.9003 },
      { latitude: 52.3731, longitude: 4.8926 }
    );
    expect(distance).toBeGreaterThan(700);
    expect(distance).toBeLessThan(850);
  });

  it('is zero from a point to itself', () => {
    expect(distanceMeters(office, office)).toBe(0);
  });
});
