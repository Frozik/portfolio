import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { Meters } from '../units';
import type { ContourPolyline } from './contour-types';

/** Which contours get an elevation caption, and where along the line it sits. */
/** Where a level's caption goes on the plan. */
export interface ContourLabel {
  readonly level: Meters;
  readonly position: Vector2;
}

/** Below three points a chain is a stub not worth captioning. */
const MIN_LABELLED_POINT_COUNT = 3;

/**
 * One caption per level, at the middle of that level's longest chain — enough to
 * read the plan without stamping a number on every ridge.
 *
 * `isPositionLabellable` is what a caller drawing only part of the terrain hands
 * in: the chains are traced over the whole sampled grid, and a caption sitting on
 * the stretch of a line that is not drawn would name nothing.
 */
export function chooseContourLabels(
  contours: readonly ContourPolyline[],
  isPositionLabellable: (position: Vector2) => boolean = acceptAnyPosition
): readonly ContourLabel[] {
  const longestByLevel = new Map<Meters, ContourPolyline>();

  for (const contour of contours) {
    const current = longestByLevel.get(contour.level);

    if (isNil(current) || contour.points.length > current.points.length) {
      longestByLevel.set(contour.level, contour);
    }
  }

  const labels: ContourLabel[] = [];

  for (const contour of longestByLevel.values()) {
    if (contour.points.length < MIN_LABELLED_POINT_COUNT) {
      continue;
    }

    const position = chooseLabelPosition(contour.points, isPositionLabellable);

    if (!isNil(position)) {
      labels.push({ level: contour.level, position });
    }
  }

  return labels;
}

function acceptAnyPosition(): boolean {
  return true;
}

/**
 * The middle of the chain, or the accepted point nearest to it — walking out
 * from the middle in both directions keeps the caption as far from the ends of
 * the line as the chain allows. Nothing at all when the whole chain is refused.
 */
function chooseLabelPosition(
  points: readonly Vector2[],
  isPositionLabellable: (position: Vector2) => boolean
): Vector2 | undefined {
  const middle = Math.floor(points.length / 2);

  for (let offset = 0; offset < points.length; offset += 1) {
    const before = middle - offset;
    const after = middle + offset;

    if (before >= 0 && isPositionLabellable(points[before])) {
      return points[before];
    }

    if (after < points.length && isPositionLabellable(points[after])) {
      return points[after];
    }
  }

  return undefined;
}
