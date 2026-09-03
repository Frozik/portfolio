import type { KeyPointSnap } from '../../../domain/view/object-snapping';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import { PLAN_COLORS } from './shared';

const SNAP_RING_RADIUS_PX = 6;
const SNAP_POINT_RADIUS_PX = 2;
const SNAP_LINE_WIDTH_PX = 1;
/** Closer than this the two points read as one, and the link between them as noise. */
const SNAP_LINK_MIN_LENGTH_PX = 1;
const FULL_CIRCLE_RADIANS = 2 * Math.PI;

export interface SnapIndicatorStyle {
  readonly strokeColor: string;
  readonly lineWidthPx: number;
}

const DEFAULT_SNAP_INDICATOR_STYLE: SnapIndicatorStyle = {
  strokeColor: PLAN_COLORS.snapIndicatorStroke,
  lineWidthPx: SNAP_LINE_WIDTH_PX,
};

/**
 * The catch an object snap has made: a ring around the point the shape was
 * pulled onto, and — while the pointer is still holding the shape away from it —
 * a dot where the pointer would have left it, with the pull drawn between them.
 */
export function drawSnapIndicator(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  snap: KeyPointSnap,
  style: SnapIndicatorStyle = DEFAULT_SNAP_INDICATOR_STYLE
): void {
  const targetScreen = planToScreen(viewport, snap.targetPoint);
  const ownScreen = planToScreen(viewport, snap.ownPoint);

  ctx.save();
  ctx.strokeStyle = style.strokeColor;
  ctx.fillStyle = style.strokeColor;
  ctx.lineWidth = style.lineWidthPx;

  if (
    Math.hypot(targetScreen.x - ownScreen.x, targetScreen.y - ownScreen.y) >=
    SNAP_LINK_MIN_LENGTH_PX
  ) {
    ctx.beginPath();
    ctx.moveTo(ownScreen.x, ownScreen.y);
    ctx.lineTo(targetScreen.x, targetScreen.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(ownScreen.x, ownScreen.y, SNAP_POINT_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(targetScreen.x, targetScreen.y, SNAP_RING_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
  ctx.stroke();
  ctx.restore();
}
