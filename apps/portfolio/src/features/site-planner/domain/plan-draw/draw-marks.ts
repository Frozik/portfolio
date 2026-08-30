import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { ElevationMark, MarkId } from '../model/site-plan';
import type { PlanViewport } from '../view/plan-viewport';
import { planToScreen } from '../view/plan-viewport';
import { drawLabel, formatMeters, PLAN_COLORS } from './shared';

/** The surveyed point itself; the flag above it is only the handle to grab. */
const MARK_DOT_RADIUS_PX = 2.5;
const SELECTED_RING_RADIUS_PX = 6;
const FLAG_POLE_HEIGHT_PX = 16;
const FLAG_WIDTH_PX = 9;
const FLAG_HEIGHT_PX = 7;
const FLAG_LINE_WIDTH_PX = 1;
const SELECTED_LINE_WIDTH_PX = 1.5;
/** Gap between the top of the pole and the elevation caption above it. */
const LABEL_GAP_PX = 9;
const FULL_CIRCLE_RADIANS = 2 * Math.PI;

export interface MarkStyle {
  readonly fillColor: string;
  readonly selectedColor: string;
  readonly textColor: string;
}

const DEFAULT_MARK_STYLE: MarkStyle = {
  fillColor: PLAN_COLORS.markFill,
  selectedColor: PLAN_COLORS.selectionStroke,
  textColor: PLAN_COLORS.textStrong,
};

/**
 * Surveyed elevation marks: a pennant on a pole with its value above it. The
 * mark being dragged arrives as `draftMark` and stands in for its stored self,
 * so the flag follows the pointer while the terrain behind it is rebuilt only
 * once the gesture lands.
 */
export function drawMarks(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  {
    marks,
    draftMark,
    selectedMarkId,
    meterUnit,
  }: {
    readonly marks: readonly ElevationMark[];
    readonly draftMark: ElevationMark | undefined;
    readonly selectedMarkId: MarkId | undefined;
    readonly meterUnit: string;
  },
  style: MarkStyle = DEFAULT_MARK_STYLE
): void {
  if (marks.length === 0) {
    return;
  }

  ctx.save();

  for (const storedMark of marks) {
    const mark = !isNil(draftMark) && draftMark.id === storedMark.id ? draftMark : storedMark;
    const screenPoint = planToScreen(viewport, mark.position);
    const isSelected = mark.id === selectedMarkId;

    drawFlag(ctx, screenPoint, isSelected, style);
    drawLabel(
      ctx,
      formatMeters(mark.elevation, meterUnit),
      { x: screenPoint.x, y: screenPoint.y - FLAG_POLE_HEIGHT_PX - LABEL_GAP_PX },
      isSelected ? style.selectedColor : style.textColor
    );
  }

  ctx.restore();
}

function drawFlag(
  ctx: CanvasRenderingContext2D,
  screenPoint: Vector2,
  isSelected: boolean,
  style: MarkStyle
): void {
  const poleTopY = screenPoint.y - FLAG_POLE_HEIGHT_PX;

  ctx.fillStyle = style.fillColor;
  ctx.strokeStyle = isSelected ? style.selectedColor : style.fillColor;
  ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH_PX : FLAG_LINE_WIDTH_PX;

  ctx.beginPath();
  ctx.moveTo(screenPoint.x, screenPoint.y);
  ctx.lineTo(screenPoint.x, poleTopY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(screenPoint.x, poleTopY);
  ctx.lineTo(screenPoint.x + FLAG_WIDTH_PX, poleTopY + FLAG_HEIGHT_PX / 2);
  ctx.lineTo(screenPoint.x, poleTopY + FLAG_HEIGHT_PX);
  ctx.closePath();
  ctx.fill();

  if (isSelected) {
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(screenPoint.x, screenPoint.y, MARK_DOT_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
  ctx.fill();

  if (isSelected) {
    ctx.beginPath();
    ctx.arc(screenPoint.x, screenPoint.y, SELECTED_RING_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
    ctx.stroke();
  }
}
