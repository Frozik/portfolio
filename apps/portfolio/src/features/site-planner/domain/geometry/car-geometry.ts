import type { Vector2 } from '@frozik/utils/math/vector2';

import { CAR_LENGTH_METERS, CAR_WIDTH_METERS } from '../constants';
import type { CarInstance } from '../model/site-plan';
import type { RotatedBox } from './hit-test-shape';
import { rectangleLocalToPlan } from './polygonize-shape';

/**
 * The car as a turned box on the plan: its length runs along the local `x` axis
 * with the nose at `+x`, matching the frame the 3D template is built in
 * (`car-mesh.ts`). Everything that has to reason about where a car is — the hit
 * test, the outline, the rotation handle — asks for this one box rather than
 * turning the car itself.
 */
export function carRotatedBox(car: CarInstance): RotatedBox {
  return {
    center: car.position,
    rotationDegrees: car.rotationDegrees,
    extentX: CAR_LENGTH_METERS,
    extentY: CAR_WIDTH_METERS,
  };
}

/** A point of the car's own frame, in plan metres. */
export function carLocalToPlan(car: CarInstance, local: Vector2): Vector2 {
  return rectangleLocalToPlan(carRotatedBox(car), local);
}
