import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import type { PlanViewport } from '../../domain/view/plan-viewport';
import type { SitePlannerStore } from '../SitePlannerStore';
import { pickPath, pickShape, pickUtilityRoute } from './plan-picking';

/**
 * The double click as the mode door in view mode (see `modes.md`): it opens
 * the editor of what it lands on — a trench first, then a path, then the plot
 * or the building whose footprint is under the pointer.
 */
export function openEditorDoorAt(
  store: SitePlannerStore,
  viewport: PlanViewport,
  planPoint: Vector2
): void {
  // A trench is a hairline over the ribbons, so its door answers first.
  const route = pickUtilityRoute(store, viewport, planPoint);

  if (!isNil(route)) {
    store.modes.openEditorDoor({
      target: { kind: 'utilityRoute', routeId: route.id },
      aimAt: undefined,
    });

    return;
  }

  const path = pickPath(store, viewport, planPoint);

  if (!isNil(path)) {
    store.modes.openEditorDoor({ target: { kind: 'path', pathId: path.id }, aimAt: undefined });

    return;
  }

  const picked = pickShape(store, viewport, planPoint);

  if (!isNil(picked)) {
    // A building opens its own editor; the plot opens site editing. The
    // footprint's shapes stay behind the site editor's door either way.
    store.modes.openEditorDoor(
      picked.owner === 'boundary'
        ? { target: { kind: 'site' }, aimAt: undefined }
        : { target: { kind: 'building', buildingId: picked.owner }, aimAt: undefined }
    );
  }
}
