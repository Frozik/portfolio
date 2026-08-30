import type { CarInstance } from '../model/site-plan';
import type { WorldPoint } from '../view/world-frame';
import { planToWorld } from '../view/world-frame';
import type { Heightfield } from './heightfield';
import { sampleHeight } from './heightfield';

/** A car ready for the 3D view: where its wheels meet the ground, and its heading. */
export interface SceneCar {
  /** Middle of the car, in world space, on the interpolated terrain. */
  readonly position: WorldPoint;
  /** Counter-clockwise turn of the nose off plan east, in degrees. */
  readonly rotationDegrees: number;
}

/**
 * Stands every car on the sampled terrain, the way the trees are stood on it
 * (A4: a placed object has no elevation of its own — the ground under it is the
 * only thing that decides where it sits).
 */
export function placeCarsOnTerrain(
  cars: readonly CarInstance[],
  field: Heightfield
): readonly SceneCar[] {
  return cars.map(car => ({
    position: planToWorld(car.position, sampleHeight(field, car.position.x, car.position.y)),
    rotationDegrees: car.rotationDegrees,
  }));
}
