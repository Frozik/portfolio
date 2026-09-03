import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { MultiPolygon, PolygonWithHoles } from '../../../domain/geometry/polygon-types';
import type { StairId } from '../../../domain/model/stairs';
import type { SupportId } from '../../../domain/model/supports';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import { buildMultiPolygonPath, drawLabel, PLAN_COLORS } from './shared';

const STEP_LINE_WIDTH_PX = 1;
const OUTLINE_LINE_WIDTH_PX = 1.4;
const SELECTED_LINE_WIDTH_PX = 2.4;
const ARROW_LINE_WIDTH_PX = 1.6;
const ARROW_HEAD_PX = 7;
const ARROW_HEAD_SPREAD_RADIANS = 0.45;
const LABEL_OFFSET_PX = 14;

const STAIR_FILL = 'rgba(214, 200, 176, 0.18)';
const STAIR_STROKE = '#d6c8b0';
/** A post is structure, so it reads as concrete rather than as joinery. */
const SUPPORT_FILL = 'rgba(148, 163, 184, 0.55)';
const SUPPORT_STROKE = '#94a3b8';

/** One stair as the plan states it — the drawing conventions of a floor plan. */
export interface PlanStair {
  readonly id: StairId;
  /** Every tread and landing, low end first. */
  readonly stepPolygons: MultiPolygon;
  readonly footprint: MultiPolygon;
  /** Where the climb starts and where it tops out — the direction arrow. */
  readonly fromPoint: Vector2;
  readonly exitPoint: Vector2;
  readonly riserCount: number;
  /** The stretch the storey above cuts open; drawn as the break line. */
  readonly cutout: MultiPolygon;
  readonly isComfortable: boolean;
  /** Where the turn grip sits, in plan metres — drawn and hit-tested alike. */
  readonly rotationGrip: Vector2;
}

/** One post as the plan shows it: its section, and whether it is selected. */
export interface PlanSupport {
  readonly id: SupportId;
  readonly footprint: PolygonWithHoles;
  /** A post beyond the storey's own footprint carries an overhang. */
  readonly isFreeStanding: boolean;
}

/**
 * The posts of the displayed storey. A post is small — its section is a
 * hand's width — so it reads as a filled dot rather than an outline, the way
 * a column is drawn on a real plan.
 */
export function drawSupports(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  supports: readonly PlanSupport[],
  { selectedSupportId }: { readonly selectedSupportId?: SupportId } = {}
): void {
  if (supports.length === 0) {
    return;
  }

  ctx.save();

  for (const support of supports) {
    const path = buildMultiPolygonPath([support.footprint], viewport);
    const isSelected = support.id === selectedSupportId;

    ctx.fillStyle = SUPPORT_FILL;
    ctx.fill(path, 'nonzero');
    ctx.strokeStyle = isSelected ? PLAN_COLORS.selectionStroke : SUPPORT_STROKE;
    ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH_PX : OUTLINE_LINE_WIDTH_PX;
    ctx.stroke(path);
  }

  ctx.restore();
}

/**
 * The stairs of the displayed storey, drawn the way a floor plan states them:
 * the treads, an arrow along the climb with «ВВЕРХ · N» beside it, and the
 * outline of the opening the storey above leaves. Without the arrow a plan
 * cannot say which way the stair goes, and the plan of the floor above cannot
 * say where you come out.
 */
export function drawStairs(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  stairs: readonly PlanStair[],
  { upLabel, selectedStairId }: { readonly upLabel: string; readonly selectedStairId?: StairId }
): void {
  if (stairs.length === 0) {
    return;
  }

  ctx.save();
  ctx.lineJoin = 'round';

  for (const stair of stairs) {
    const isSelected = stair.id === selectedStairId;

    ctx.fillStyle = STAIR_FILL;
    ctx.strokeStyle = stair.isComfortable ? STAIR_STROKE : PLAN_COLORS.warningStroke;
    ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH_PX : OUTLINE_LINE_WIDTH_PX;

    const outline = buildMultiPolygonPath(stair.footprint, viewport);

    ctx.fill(outline);
    ctx.stroke(outline);

    ctx.lineWidth = STEP_LINE_WIDTH_PX;
    ctx.stroke(buildMultiPolygonPath(stair.stepPolygons, viewport));

    drawClimbArrow(ctx, viewport, stair);

    const label = planToScreen(viewport, stair.exitPoint);

    drawLabel(
      ctx,
      `${upLabel} · ${stair.riserCount}`,
      { x: label.x, y: label.y - LABEL_OFFSET_PX },
      stair.isComfortable ? PLAN_COLORS.textStrong : PLAN_COLORS.warningStroke
    );
  }

  ctx.restore();
}

function drawClimbArrow(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  stair: PlanStair
): void {
  const from = planToScreen(viewport, stair.fromPoint);
  const to = planToScreen(viewport, stair.exitPoint);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);

  if (isNil(angle)) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = STAIR_STROKE;
  ctx.lineWidth = ARROW_LINE_WIDTH_PX;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - Math.cos(angle - ARROW_HEAD_SPREAD_RADIANS) * ARROW_HEAD_PX,
    to.y - Math.sin(angle - ARROW_HEAD_SPREAD_RADIANS) * ARROW_HEAD_PX
  );
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - Math.cos(angle + ARROW_HEAD_SPREAD_RADIANS) * ARROW_HEAD_PX,
    to.y - Math.sin(angle + ARROW_HEAD_SPREAD_RADIANS) * ARROW_HEAD_PX
  );
  ctx.stroke();
  ctx.restore();
}
