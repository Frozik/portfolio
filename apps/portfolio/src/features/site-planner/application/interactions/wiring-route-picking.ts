import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { distanceToPolyline } from '../../domain/geometry/hit-test-objects';
import type { BuildingId } from '../../domain/model/building';
import { wiringRoutesOf } from '../../domain/model/storeys';
import type { WiringRoute } from '../../domain/model/wiring-routes';
import type { InteractionContext } from './editor-interaction';
import { activeStoreyOf, DEVICE_PICK_RADIUS_PX } from './storey-object-picking';

/** A drawn cable route is a hairline: it answers over the device halo, topmost first. */
export function pickWiringRoute(
  context: InteractionContext,
  buildingId: BuildingId,
  planPoint: Vector2
): WiringRoute | undefined {
  const storey = activeStoreyOf(context, buildingId);

  if (isNil(storey)) {
    return undefined;
  }

  const tolerance = DEVICE_PICK_RADIUS_PX / context.getViewport().pixelsPerMeter;
  const routes = wiringRoutesOf(storey);

  for (let index = routes.length - 1; index >= 0; index -= 1) {
    if (distanceToPolyline(routes[index].points, planPoint) <= tolerance) {
      return routes[index];
    }
  }

  return undefined;
}
