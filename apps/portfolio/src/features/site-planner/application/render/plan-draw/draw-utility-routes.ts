import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { UtilitySystem } from '../../../domain/model/foundation';
import type { UtilityRoute, UtilityRouteId } from '../../../domain/model/routing';
import { routeLengthMeters } from '../../../domain/model/routing';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import { UTILITY_SYSTEM_COLORS } from './draw-house';

const ROUTE_LINE_WIDTH_PX = 1.6;
const SELECTED_LINE_WIDTH_PX = 2.6;
/** Long dash, short gap — the convention engineering plans draw networks in. */
const ROUTE_DASH_PATTERN_PX: readonly number[] = [7, 4];
const BEND_RADIUS_PX = 2.5;
const BADGE_RADIUS_PX = 6;
const BADGE_FONT_SIZE_PX = 8;
const BADGE_FILL = '#1c1917';
const FULL_CIRCLE_RADIANS = 2 * Math.PI;
const HALF = 0.5;

/** The polyline being clicked out with the trench tool, cursor at its tail. */
export interface UtilityRouteDraft {
  readonly system: UtilitySystem;
  readonly points: readonly Vector2[];
}

/**
 * The site trenches as an engineering plan draws them: a dashed run in the
 * system's colour, a dot on every bend, and the system's letter riding the
 * middle of the run — the same letter its entry badge wears on the outline.
 */
export function drawUtilityRoutes(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  {
    routes,
    selectedRouteId,
    draft,
    entryLetters,
  }: {
    readonly routes: readonly UtilityRoute[];
    readonly selectedRouteId: UtilityRouteId | undefined;
    readonly draft: UtilityRouteDraft | undefined;
    readonly entryLetters: Readonly<Record<UtilitySystem, string>>;
  }
): void {
  if (routes.length === 0 && isNil(draft)) {
    return;
  }

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const route of routes) {
    drawRoutePolyline(ctx, viewport, route.points, route.system, {
      isSelected: route.id === selectedRouteId,
    });
    drawSystemBadge(ctx, viewport, route.points, route.system, entryLetters);
  }

  if (!isNil(draft) && draft.points.length > 0) {
    drawRoutePolyline(ctx, viewport, draft.points, draft.system, { isSelected: true });
  }

  ctx.restore();
}

function drawRoutePolyline(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  points: readonly Vector2[],
  system: UtilitySystem,
  { isSelected }: { readonly isSelected: boolean }
): void {
  const screenPoints = points.map(point => planToScreen(viewport, point));

  ctx.strokeStyle = UTILITY_SYSTEM_COLORS[system];
  ctx.fillStyle = UTILITY_SYSTEM_COLORS[system];
  ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH_PX : ROUTE_LINE_WIDTH_PX;
  ctx.setLineDash([...ROUTE_DASH_PATTERN_PX]);

  ctx.beginPath();

  screenPoints.forEach((screenPoint, index) => {
    if (index === 0) {
      ctx.moveTo(screenPoint.x, screenPoint.y);
    } else {
      ctx.lineTo(screenPoint.x, screenPoint.y);
    }
  });

  ctx.stroke();
  ctx.setLineDash([]);

  for (const screenPoint of screenPoints) {
    ctx.beginPath();
    ctx.arc(screenPoint.x, screenPoint.y, BEND_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
    ctx.fill();
  }
}

function drawSystemBadge(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  points: readonly Vector2[],
  system: UtilitySystem,
  entryLetters: Readonly<Record<UtilitySystem, string>>
): void {
  const middle = pointAtRunMiddle(points);

  if (isNil(middle)) {
    return;
  }

  const { x, y } = planToScreen(viewport, middle);

  ctx.beginPath();
  ctx.arc(x, y, BADGE_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
  ctx.fillStyle = UTILITY_SYSTEM_COLORS[system];
  ctx.fill();
  ctx.fillStyle = BADGE_FILL;
  ctx.font = `bold ${BADGE_FONT_SIZE_PX}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(entryLetters[system], x, y);
}

/** The point half the run's length along it — where the badge sits. */
function pointAtRunMiddle(points: readonly Vector2[]): Vector2 | undefined {
  if (points.length < 2) {
    return undefined;
  }

  let remaining = routeLengthMeters(points) * HALF;

  for (let index = 0; index + 1 < points.length; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);

    if (segmentLength >= remaining && segmentLength > 0) {
      const fraction = remaining / segmentLength;

      return {
        x: start.x + (end.x - start.x) * fraction,
        y: start.y + (end.y - start.y) * fraction,
      };
    }

    remaining -= segmentLength;
  }

  return points[points.length - 1];
}
