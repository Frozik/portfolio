import type { Vector2 } from '@frozik/utils/math/vector2';
import type { PolygonWithHoles } from '../../../domain/geometry/polygon-types';
import type { DuctId, DuctKind } from '../../../domain/model/ducts';
import type { FireplaceId } from '../../../domain/model/fireplaces';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import { buildMultiPolygonPath, PLAN_COLORS } from './shared';

const OUTLINE_LINE_WIDTH_PX = 1.4;
const SELECTED_LINE_WIDTH_PX = 2.4;
const HATCH_LINE_WIDTH_PX = 1;
const FIRE_ARC_LINE_WIDTH_PX = 1.4;
const FULL_CIRCLE_RADIANS = 2 * Math.PI;

/** Masonry reads warm; a shaft that only passes through reads as a hole. */
const FIREPLACE_FILL = 'rgba(214, 143, 96, 0.22)';
const FIREPLACE_STROKE = '#d68f60';
const FLUE_FILL = 'rgba(214, 143, 96, 0.3)';
const VENT_FILL = 'rgba(125, 211, 252, 0.25)';
const VENT_STROKE = '#7dd3fc';

/** One fireplace as a floor plan states it: the body, and the fire it holds. */
export interface PlanFireplace {
  readonly id: FireplaceId;
  readonly footprint: PolygonWithHoles;
  /** Centre of the firebox — the arc the plan draws to say which way it faces. */
  readonly firePoint: Vector2;
  readonly fluePosition: Vector2;
}

/** One shaft's section on this storey. */
export interface PlanDuct {
  readonly id: DuctId;
  readonly kind: DuctKind;
  readonly footprint: PolygonWithHoles;
  /** A shaft that only passes through this floor is drawn as a hole in it. */
  readonly isPassingThrough: boolean;
}

/**
 * The fireplaces and the shafts of the displayed storey. A shaft is drawn on
 * EVERY floor it crosses — that is the point of drawing it at all: the chimney
 * standing in the middle of the bedroom upstairs is the thing a plan has to
 * make visible before the wall goes up around it.
 */
export function drawHeating(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  {
    fireplaces,
    ducts,
    selectedFireplaceId,
    selectedDuctId,
  }: {
    readonly fireplaces: readonly PlanFireplace[];
    readonly ducts: readonly PlanDuct[];
    readonly selectedFireplaceId?: FireplaceId;
    readonly selectedDuctId?: DuctId;
  }
): void {
  if (fireplaces.length === 0 && ducts.length === 0) {
    return;
  }

  ctx.save();
  ctx.lineJoin = 'round';

  for (const fireplace of fireplaces) {
    const path = buildMultiPolygonPath([fireplace.footprint], viewport);
    const isSelected = fireplace.id === selectedFireplaceId;

    ctx.fillStyle = FIREPLACE_FILL;
    ctx.fill(path, 'nonzero');
    ctx.strokeStyle = isSelected ? PLAN_COLORS.selectionStroke : FIREPLACE_STROKE;
    ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH_PX : OUTLINE_LINE_WIDTH_PX;
    ctx.stroke(path);

    drawFireMark(ctx, planToScreen(viewport, fireplace.firePoint));
  }

  for (const duct of ducts) {
    const path = buildMultiPolygonPath([duct.footprint], viewport);
    const isSelected = duct.id === selectedDuctId;
    const isFlue = duct.kind === 'flue';

    ctx.fillStyle = isFlue ? FLUE_FILL : VENT_FILL;
    ctx.fill(path, 'nonzero');
    ctx.strokeStyle = isSelected
      ? PLAN_COLORS.selectionStroke
      : isFlue
        ? FIREPLACE_STROKE
        : VENT_STROKE;
    ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH_PX : OUTLINE_LINE_WIDTH_PX;
    ctx.stroke(path);

    if (duct.isPassingThrough) {
      drawShaftCross(ctx, viewport, duct.footprint);
    }
  }

  ctx.restore();
}

/** The section mark every plan puts on a shaft: crossed diagonals. */
function drawShaftCross(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  footprint: PolygonWithHoles
): void {
  const corners = footprint.outer.map(corner => planToScreen(viewport, corner));

  if (corners.length < 4) {
    return;
  }

  ctx.save();
  ctx.lineWidth = HATCH_LINE_WIDTH_PX;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[2].x, corners[2].y);
  ctx.moveTo(corners[1].x, corners[1].y);
  ctx.lineTo(corners[3].x, corners[3].y);
  ctx.stroke();
  ctx.restore();
}

const FIRE_MARK_RADIUS_PX = 5;

/** A small ring in the firebox — where the fire is, and which way it opens. */
function drawFireMark(ctx: CanvasRenderingContext2D, at: Vector2): void {
  ctx.save();
  ctx.lineWidth = FIRE_ARC_LINE_WIDTH_PX;
  ctx.beginPath();
  ctx.arc(at.x, at.y, FIRE_MARK_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
  ctx.stroke();
  ctx.restore();
}
