import { isNil } from 'lodash-es';

import type { Vec3Array } from '../../domain/topology-types';
import type { DragPreviewState } from '../drag-connector';

export interface PreviewLine {
  readonly pointA: Vec3Array;
  readonly pointB: Vec3Array;
}

/**
 * Endpoints of the drag preview. A vertex drag runs from its vertex to the
 * snapped vertex or the cursor; a line drag is a line parallel to the source,
 * anchored at the snapped vertex or at the cursor projected onto the plane
 * through the source line.
 */
export function computeDragPreviewLine(
  preview: DragPreviewState,
  unproject: (screenX: number, screenY: number, reference: Vec3Array) => Vec3Array
): PreviewLine {
  if (preview.kind === 'vertex') {
    const pointB = isNil(preview.snapTargetPosition)
      ? unproject(preview.cursorScreenX, preview.cursorScreenY, preview.startPosition)
      : preview.snapTargetPosition;
    return { pointA: preview.startPosition, pointB };
  }

  const anchor = isNil(preview.snapTargetPosition)
    ? unproject(preview.cursorScreenX, preview.cursorScreenY, preview.planeAnchor)
    : preview.snapTargetPosition;

  return {
    pointA: anchor,
    pointB: [
      anchor[0] + preview.sourceDirection[0],
      anchor[1] + preview.sourceDirection[1],
      anchor[2] + preview.sourceDirection[2],
    ],
  };
}
