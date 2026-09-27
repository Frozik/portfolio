import type { Vector2 } from '@frozik/utils/math/vector2';

import { scale } from '../../domain/vector';
import type { Station } from './station';

/** One round of the station's day: out of the planet's shadow, through the sun and back in. */
const DAY_SECONDS = 14;
/** The planet's shadow where it falls on the station, in half spans: a disc wide enough that its edge reads as an arc, not a line. */
const SHADOW_RADIUS = 2.4;
/**
 * How far the shadow's edge swings either side of the station's middle,
 * in half spans: further than any part of the station reaches, so at one
 * end of the swing the whole of it is lit and at the other none of it is.
 */
const EDGE_SWING = 2;
const FULL_TURN = Math.PI * 2;

/** The planet's shadow in the station's own frame, in half spans of its truss. */
export interface StationLight {
  readonly shadowCentre: Vector2;
  readonly shadowRadius: number;
}

export function stationLightOf(station: Station): StationLight {
  const edge =
    EDGE_SWING * Math.sin(FULL_TURN * (station.ageSeconds / DAY_SECONDS + station.dayShare));
  return {
    shadowCentre: scale(station.shadowWay, edge + SHADOW_RADIUS),
    shadowRadius: SHADOW_RADIUS,
  };
}
