import { isNil } from 'lodash-es';
import type { MultiPolygon } from '../../../domain/geometry/polygon-types';
import type { DoorSwingGeometry } from '../../../domain/geometry/wall-geometry';
import type { OpeningId, OpeningKind } from '../../../domain/model/openings';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import { SELECTED_LINE_WIDTH_PX, WALL_LINE_WIDTH_PX } from './draw-wall-bodies';
import { buildMultiPolygonPath, PLAN_COLORS } from './shared';

/** One opening as the drawing needs it: the cut it makes in its wall. */
export interface PlanOpening {
  readonly id: OpeningId;
  readonly kind: OpeningKind;
  readonly polygons: MultiPolygon;
  /** How a door's leaf hangs and sweeps; nothing for a window. */
  readonly swing?: DoorSwingGeometry;
}

/** A door reads as a clean break in the wall; a window as glass across it. */
const DOOR_FILL = 'rgba(13, 16, 22, 0.9)';

const WINDOW_FILL = 'rgba(148, 197, 250, 0.35)';

const OPENING_STROKE = '#cbd5e1';

/** The leaf reads solid, the sweep it needs kept clear reads dashed. */
const SWING_STROKE = 'rgba(203, 213, 225, 0.75)';

const SWING_LINE_WIDTH_PX = 1;

const SWING_DASH_PATTERN_PX: readonly number[] = [3, 3];

/**
 * The cuts the openings make, painted over the wall bodies: a door breaks the
 * wall open, a window lays glass across the break. The selected one answers
 * in the accent.
 */
export function drawOpenings(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  openings: readonly PlanOpening[],
  selectedOpeningId?: OpeningId
): void {
  if (openings.length === 0) {
    return;
  }

  ctx.save();
  ctx.lineJoin = 'round';

  for (const opening of openings) {
    if (opening.polygons.length === 0) {
      continue;
    }

    const path = buildMultiPolygonPath(opening.polygons, viewport);
    const isSelected = opening.id === selectedOpeningId;

    ctx.fillStyle = opening.kind === 'door' ? DOOR_FILL : WINDOW_FILL;
    ctx.fill(path, 'nonzero');
    ctx.strokeStyle = isSelected ? PLAN_COLORS.selectionStroke : OPENING_STROKE;
    ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH_PX : WALL_LINE_WIDTH_PX;
    ctx.stroke(path);

    if (!isNil(opening.swing)) {
      drawDoorSwing(ctx, viewport, opening.swing);
    }
  }

  ctx.restore();
}

/**
 * The leaf and the quarter arc it sweeps — the convention every floor plan
 * since the drawing board has used to say which way a door opens and where it
 * must be kept clear.
 */
function drawDoorSwing(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  swing: DoorSwingGeometry
): void {
  const hinge = planToScreen(viewport, swing.hinge);
  const leafEnd = planToScreen(viewport, swing.leafEnd);
  const radiusPx = swing.radiusMeters * viewport.pixelsPerMeter;

  ctx.save();
  ctx.strokeStyle = SWING_STROKE;
  ctx.lineWidth = SWING_LINE_WIDTH_PX;

  ctx.beginPath();
  ctx.moveTo(hinge.x, hinge.y);
  ctx.lineTo(leafEnd.x, leafEnd.y);
  ctx.stroke();

  ctx.setLineDash([...SWING_DASH_PATTERN_PX]);
  ctx.beginPath();
  // Plan y runs north but the canvas y runs down, so the sweep is mirrored on
  // screen: the arc that turns left on the plan turns right here.
  ctx.arc(
    hinge.x,
    hinge.y,
    radiusPx,
    -swing.startAngle,
    -swing.endAngle,
    !swing.isCounterClockwise
  );
  ctx.stroke();
  ctx.restore();
}
