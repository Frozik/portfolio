import type { Vector2 } from '@frozik/utils/math/vector2';

import type { SitePath } from '../../domain/model/site-plan';
import type { InteractionContext } from './editor-interaction';
import { applyPolylineHandleHover, PolylinePointGestures } from './polyline-point-gestures';

/**
 * The path instantiation of the shared polyline point gestures: points live on
 * `PathPoint.position`, edits go through the path actions, and the grabbed
 * point becomes the СЕГМЕНТЫ panel's edited one inside path editing.
 */
export class PathPointGestures extends PolylinePointGestures<SitePath> {
  constructor(context: InteractionContext) {
    super(context, {
      selected: () => context.store.siteObjects.selectedPath,
      positions: path => path.points.map(point => point.position),
      movePoint: (path, pointIndex, position) =>
        context.store.siteObjects.movePathPoint(path.id, pointIndex, position),
      insertPoint: (path, segmentIndex, position) =>
        context.store.siteObjects.insertPathPoint(path.id, segmentIndex, position),
      restore: path => context.store.siteObjects.updatePath(path),
      onGrabbed: pointIndex => context.store.setSelectedPathPointIndex(pointIndex),
    });
  }
}

/** The hover half, over the selected path's handles. */
export function applyPathHandleHover(
  context: InteractionContext,
  planPoint: Vector2,
  options: { readonly includeMidpoints: boolean }
): void {
  applyPolylineHandleHover(
    context,
    planPoint,
    context.store.siteObjects.selectedPath?.points.map(point => point.position),
    options
  );
}
