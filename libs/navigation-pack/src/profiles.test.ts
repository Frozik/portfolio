import { ACCESS_BIT, EDGE_FLAG, PROFILES, ROAD_CLASS, ROAD_CLASS_COUNT } from './format';
import { classifyHighway, computeWayAccess, PROFILE_SPEED_KMH } from './profiles';

function tags(entries: Record<string, string>): ReadonlyMap<string, string> {
  return new Map(Object.entries(entries));
}

describe('profiles', () => {
  it('has a speed for every road class in every profile', () => {
    for (const profile of PROFILES) {
      expect(PROFILE_SPEED_KMH[profile]).toHaveLength(ROAD_CLASS_COUNT);
    }
  });

  it('maps link roads to their parent class and ignores non-road highways', () => {
    expect(classifyHighway('primary_link')).toBe(ROAD_CLASS.primary);
    expect(classifyHighway('living_street')).toBe(ROAD_CLASS.livingStreet);
    expect(classifyHighway('construction')).toBeUndefined();
    expect(classifyHighway(undefined)).toBeUndefined();
  });

  it('lets everyone use a residential street in both directions', () => {
    const access = computeWayAccess(tags({ highway: 'residential' }), ROAD_CLASS.residential);
    expect(access?.access).toBe(
      ACCESS_BIT.carForward |
        ACCESS_BIT.carBackward |
        ACCESS_BIT.footForward |
        ACCESS_BIT.footBackward |
        ACCESS_BIT.bikeForward |
        ACCESS_BIT.bikeBackward
    );
    expect(access?.flags).toBe(0);
  });

  it('keeps pedestrians off motorways and cars off footways', () => {
    const motorway = computeWayAccess(tags({ highway: 'motorway' }), ROAD_CLASS.motorway);
    expect(motorway?.access).toBe(ACCESS_BIT.carForward | ACCESS_BIT.carBackward);
    const footway = computeWayAccess(tags({ highway: 'footway' }), ROAD_CLASS.footway);
    expect((footway?.access ?? 0) & ACCESS_BIT.footForward).not.toBe(0);
    expect((footway?.access ?? 0) & (ACCESS_BIT.carForward | ACCESS_BIT.carBackward)).toBe(0);
  });

  it('applies oneway to cars and bikes but not to pedestrians', () => {
    const access = computeWayAccess(
      tags({ highway: 'residential', oneway: 'yes' }),
      ROAD_CLASS.residential
    );
    expect((access?.access ?? 0) & ACCESS_BIT.carBackward).toBe(0);
    expect((access?.access ?? 0) & ACCESS_BIT.bikeBackward).toBe(0);
    expect((access?.access ?? 0) & ACCESS_BIT.footBackward).not.toBe(0);
    expect((access?.flags ?? 0) & EDGE_FLAG.oneway).not.toBe(0);
  });

  it('lets bikes ride against a oneway tagged oneway:bicycle=no', () => {
    const access = computeWayAccess(
      tags({ highway: 'residential', oneway: 'yes', 'oneway:bicycle': 'no' }),
      ROAD_CLASS.residential
    );
    expect((access?.access ?? 0) & ACCESS_BIT.bikeBackward).not.toBe(0);
    expect((access?.access ?? 0) & ACCESS_BIT.carBackward).toBe(0);
  });

  it('treats a roundabout as oneway and flags it', () => {
    const access = computeWayAccess(
      tags({ highway: 'primary', junction: 'roundabout' }),
      ROAD_CLASS.primary
    );
    expect((access?.access ?? 0) & ACCESS_BIT.carBackward).toBe(0);
    expect((access?.flags ?? 0) & EDGE_FLAG.roundabout).not.toBe(0);
  });

  it('honours the access hierarchy: the most specific tag wins', () => {
    const privateRoad = computeWayAccess(
      tags({ highway: 'service', access: 'private', foot: 'yes' }),
      ROAD_CLASS.service
    );
    expect(privateRoad?.access).toBe(ACCESS_BIT.footForward | ACCESS_BIT.footBackward);
    const noVehicles = computeWayAccess(
      tags({ highway: 'residential', vehicle: 'no', bicycle: 'yes' }),
      ROAD_CLASS.residential
    );
    expect((noVehicles?.access ?? 0) & ACCESS_BIT.carForward).toBe(0);
    expect((noVehicles?.access ?? 0) & ACCESS_BIT.bikeForward).not.toBe(0);
    expect(
      computeWayAccess(tags({ highway: 'residential', access: 'no' }), ROAD_CLASS.residential)
    ).toBeUndefined();
  });
});
