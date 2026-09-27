import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import type { Station } from './station';
import { STATION_HALF_SPAN_METERS, STATION_REACH_METERS } from './station';
import { stationLightOf } from './station-light';

const DAY_SECONDS = 14;
const REACH = STATION_REACH_METERS / STATION_HALF_SPAN_METERS;
const STATION: Station = {
  position: { x: 3, y: 47 },
  attitude: { x: 0, y: -1 },
  ageSeconds: 0,
  dayShare: 0,
  shadowWay: { x: 0.6, y: 0.8 },
};

/** How far out of the planet's shadow a point of the station's own frame lies: negative inside it. */
function beyondShadow(station: Station, local: Vector2): number {
  const { shadowCentre, shadowRadius } = stationLightOf(station);
  return Math.hypot(local.x - shadowCentre.x, local.y - shadowCentre.y) - shadowRadius;
}

function rimOf(reach: number): readonly Vector2[] {
  return Array.from({ length: 16 }, (_, index) => {
    const angle = (index / 16) * Math.PI * 2;
    return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
  });
}

describe('the light on the station', () => {
  it('stands the whole of it in the sun at one end of its day and in the shadow at the other', () => {
    const noon = { ...STATION, ageSeconds: DAY_SECONDS / 4 };
    const midnight = { ...STATION, ageSeconds: (DAY_SECONDS * 3) / 4 };

    for (const point of rimOf(REACH)) {
      expect(beyondShadow(noon, point)).toBeGreaterThan(0);
      expect(beyondShadow(midnight, point)).toBeLessThan(0);
    }
  });

  it('brings the edge of the shadow across it in between, one side lit and the other dark', () => {
    const dusk = { ...STATION, ageSeconds: DAY_SECONDS / 2 };

    expect(beyondShadow(dusk, { x: 0, y: 0 })).toBeCloseTo(0, 9);
    expect(beyondShadow(dusk, STATION.shadowWay)).toBeLessThan(0);
    expect(
      beyondShadow(dusk, { x: -STATION.shadowWay.x, y: -STATION.shadowWay.y })
    ).toBeGreaterThan(0);
  });

  it('comes round to the same light a day later', () => {
    const later = { ...STATION, ageSeconds: 3 + DAY_SECONDS };

    const [before, after] = [stationLightOf({ ...STATION, ageSeconds: 3 }), stationLightOf(later)];

    expect(after.shadowCentre.x).toBeCloseTo(before.shadowCentre.x, 9);
    expect(after.shadowCentre.y).toBeCloseTo(before.shadowCentre.y, 9);
  });

  it('starts each station where in its day it set out, so no two passes are lit alike', () => {
    const other = { ...STATION, dayShare: 0.25 };

    expect(stationLightOf(other).shadowCentre).not.toEqual(stationLightOf(STATION).shadowCentre);
  });
});
