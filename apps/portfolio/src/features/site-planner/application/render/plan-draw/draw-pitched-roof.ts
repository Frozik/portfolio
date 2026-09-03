import type { Vector2 } from '@frozik/utils/math/vector2';

import type { RoofCrease } from '../../../domain/geometry/pitched-roof';
import type { MultiPolygon } from '../../../domain/geometry/polygon-types';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import { buildMultiPolygonPath } from './shared';

const EAVES_LINE_WIDTH_PX = 1.2;
const RIDGE_LINE_WIDTH_PX = 2;
const HIP_LINE_WIDTH_PX = 1.2;
const EAVES_DASH_PX: readonly number[] = [10, 4, 2, 4];
const ARROW_LENGTH_PX = 18;
const ARROW_HEAD_PX = 5;
const ARROW_HEAD_SPREAD_RADIANS = 0.5;

const EAVES_STROKE = '#8d93a1';
const CREASE_STROKE = '#c7ccd8';
const SLOPE_ARROW_STROKE = '#8d93a1';

/** The roof as the plan states it: the eaves, the creases and the slope arrows. */
export interface PlanPitchedRoof {
  /** The eaves outline — the storey below grown by the overhang. */
  readonly outline: MultiPolygon;
  readonly creases: readonly RoofCrease[];
  /** One arrow per slope, pointing the way water runs off it. */
  readonly slopeArrows: readonly PlanSlopeArrow[];
}

export interface PlanSlopeArrow {
  readonly at: Vector2;
  /** Plan direction of the steepest descent, normalized. */
  readonly direction: Vector2;
}

/**
 * The roof plan (план кровли). Drawn over the storey it crowns, never filled:
 * a filled roof would hide the plan under it, and what a roof plan has to say
 * is where the eaves fall, where the ridge runs and which way the water goes.
 */
export function drawPitchedRoof(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  roof: PlanPitchedRoof | undefined
): void {
  if (roof === undefined || roof.outline.length === 0) {
    return;
  }

  ctx.save();
  ctx.lineJoin = 'round';

  ctx.setLineDash(EAVES_DASH_PX);
  ctx.strokeStyle = EAVES_STROKE;
  ctx.lineWidth = EAVES_LINE_WIDTH_PX;
  ctx.stroke(buildMultiPolygonPath(roof.outline, viewport));

  ctx.setLineDash([]);
  ctx.strokeStyle = CREASE_STROKE;

  for (const crease of roof.creases) {
    const from = planToScreen(viewport, crease.from);
    const to = planToScreen(viewport, crease.to);

    ctx.lineWidth = crease.isRidge ? RIDGE_LINE_WIDTH_PX : HIP_LINE_WIDTH_PX;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  ctx.strokeStyle = SLOPE_ARROW_STROKE;
  ctx.lineWidth = HIP_LINE_WIDTH_PX;

  for (const arrow of roof.slopeArrows) {
    drawSlopeArrow(ctx, viewport, arrow);
  }

  ctx.restore();
}

/** The «уклон» arrow: from the ridge down the slope, the way the water runs. */
function drawSlopeArrow(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  arrow: PlanSlopeArrow
): void {
  const start = planToScreen(viewport, arrow.at);
  // Screen y runs down while plan y runs up, so the direction flips its y.
  const end = {
    x: start.x + arrow.direction.x * ARROW_LENGTH_PX,
    y: start.y - arrow.direction.y * ARROW_LENGTH_PX,
  };
  const angle = Math.atan2(end.y - start.y, end.x - start.x);

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - Math.cos(angle - ARROW_HEAD_SPREAD_RADIANS) * ARROW_HEAD_PX,
    end.y - Math.sin(angle - ARROW_HEAD_SPREAD_RADIANS) * ARROW_HEAD_PX
  );
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - Math.cos(angle + ARROW_HEAD_SPREAD_RADIANS) * ARROW_HEAD_PX,
    end.y - Math.sin(angle + ARROW_HEAD_SPREAD_RADIANS) * ARROW_HEAD_PX
  );
  ctx.stroke();
}
