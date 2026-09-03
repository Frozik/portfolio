import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';

import { polygonizeShape, rectangleLocalToPlan } from '../../../domain/geometry/polygonize-shape';
import type {
  CircleShape,
  EllipseShape,
  RectangleShape,
  Shape,
} from '../../../domain/model/shapes';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import { buildRingPath, PLAN_COLORS } from './shared';

const SKELETON_LINE_WIDTH_PX = 1;
const SKELETON_DASH_PATTERN_PX: readonly number[] = [4, 4];
/** Half-length of each arm of the cross marking a centre. */
const CENTER_CROSS_ARM_PX = 4;
const FULL_CIRCLE_RADIANS = 2 * Math.PI;

/** The diagonals of a rectangle, as index pairs into its corner ring. */
/** Ends of the ellipse's two axes, as fractions of its bounding extents. */
const ELLIPSE_AXIS_FACTORS: readonly (readonly [Vector2, Vector2])[] = [
  [
    { x: -0.5, y: 0 },
    { x: 0.5, y: 0 },
  ],
  [
    { x: 0, y: -0.5 },
    { x: 0, y: 0.5 },
  ],
];

const RECTANGLE_DIAGONALS: readonly (readonly [number, number])[] = [
  [0, 2],
  [1, 3],
];

export interface ShapeSkeletonStyle {
  readonly strokeColor: string;
  readonly lineWidthPx: number;
  readonly dashPatternPx: readonly number[];
}

const DEFAULT_SHAPE_SKELETON_STYLE: ShapeSkeletonStyle = {
  strokeColor: PLAN_COLORS.skeletonStroke,
  lineWidthPx: SKELETON_LINE_WIDTH_PX,
  dashPatternPx: SKELETON_DASH_PATTERN_PX,
};

/**
 * Dashed outlines of the shapes a running gesture is not touching, together
 * with the lines that expose the points a shape can be aligned to: the
 * diagonals of a rectangle and the cross of every centre. The crosses are drawn
 * solid, in a pass of their own — an arm four pixels long has no room for a dash.
 */
export function drawShapeSkeletons(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  shapes: readonly Shape[],
  style: ShapeSkeletonStyle = DEFAULT_SHAPE_SKELETON_STYLE
): void {
  if (shapes.length === 0) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.lineWidthPx;
  ctx.setLineDash([...style.dashPatternPx]);

  for (const shape of shapes) {
    drawOutline(ctx, viewport, shape);
  }

  ctx.setLineDash([]);

  for (const shape of shapes) {
    drawCenterCross(ctx, planToScreen(viewport, shape.center));
  }

  ctx.restore();
}

function drawOutline(ctx: CanvasRenderingContext2D, viewport: PlanViewport, shape: Shape): void {
  switch (shape.kind) {
    case 'rectangle':
      drawRectangleOutline(ctx, viewport, shape);

      return;
    case 'ellipse':
      drawEllipseOutline(ctx, viewport, shape);

      return;
    case 'circle':
      drawCircleOutline(ctx, viewport, shape);

      return;
    default:
      assertNever(shape);
  }
}

/** The curve plus its two axes — the ellipse's own diagonals. */
function drawEllipseOutline(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  ellipse: EllipseShape
): void {
  ctx.stroke(buildRingPath(polygonizeShape(ellipse), viewport));

  ctx.beginPath();

  for (const [from, to] of ELLIPSE_AXIS_FACTORS) {
    const start = planToScreen(
      viewport,
      rectangleLocalToPlan(ellipse, { x: from.x * ellipse.width, y: from.y * ellipse.length })
    );
    const end = planToScreen(
      viewport,
      rectangleLocalToPlan(ellipse, { x: to.x * ellipse.width, y: to.y * ellipse.length })
    );

    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
  }

  ctx.stroke();
}

function drawRectangleOutline(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  rectangle: RectangleShape
): void {
  const corners = polygonizeShape(rectangle);

  ctx.stroke(buildRingPath(corners, viewport));

  const screenCorners = corners.map(corner => planToScreen(viewport, corner));

  ctx.beginPath();

  for (const [fromIndex, toIndex] of RECTANGLE_DIAGONALS) {
    ctx.moveTo(screenCorners[fromIndex].x, screenCorners[fromIndex].y);
    ctx.lineTo(screenCorners[toIndex].x, screenCorners[toIndex].y);
  }

  ctx.stroke();
}

function drawCircleOutline(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  circle: CircleShape
): void {
  const center = planToScreen(viewport, circle.center);

  ctx.beginPath();
  ctx.arc(center.x, center.y, circle.radius * viewport.pixelsPerMeter, 0, FULL_CIRCLE_RADIANS);
  ctx.stroke();
}

function drawCenterCross(ctx: CanvasRenderingContext2D, screenPoint: Vector2): void {
  ctx.beginPath();
  ctx.moveTo(screenPoint.x - CENTER_CROSS_ARM_PX, screenPoint.y);
  ctx.lineTo(screenPoint.x + CENTER_CROSS_ARM_PX, screenPoint.y);
  ctx.moveTo(screenPoint.x, screenPoint.y - CENTER_CROSS_ARM_PX);
  ctx.lineTo(screenPoint.x, screenPoint.y + CENTER_CROSS_ARM_PX);
  ctx.stroke();
}
