import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';

import {
  rectangleLocalDirection,
  rectangleLocalToPlan,
} from '../../../domain/geometry/polygonize-shape';
import type { BoxedShape, CircleShape, Shape } from '../../../domain/model/shapes';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planDirectionToScreen, planToScreen } from '../../../domain/view/plan-viewport';
import { drawLabel, formatMeters, PLAN_COLORS } from './shared';

/** Clearance between the measured edge and its dimension line. */
const DIMENSION_OFFSET_PX = 18;
const DIMENSION_TICK_HALF_PX = 4;
const DIMENSION_LINE_WIDTH_PX = 1;
const RADIUS_LABEL_PREFIX = 'R ';

export interface DimensionsStyle {
  readonly strokeColor: string;
  readonly textColor: string;
  readonly lineWidthPx: number;
}

const DEFAULT_DIMENSIONS_STYLE: DimensionsStyle = {
  strokeColor: PLAN_COLORS.dimensionStroke,
  textColor: PLAN_COLORS.textStrong,
  lineWidthPx: DIMENSION_LINE_WIDTH_PX,
};

/**
 * Measured extents of the selected shape: width and length outside a rectangle,
 * the radius inside a circle. Labels stay axis-aligned however the shape is
 * rotated — a rotated readout is harder to scan than an offset one.
 */
export function drawDimensions(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  { shape, meterUnit }: { readonly shape: Shape; readonly meterUnit: string },
  style: DimensionsStyle = DEFAULT_DIMENSIONS_STYLE
): void {
  ctx.save();
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.lineWidthPx;

  switch (shape.kind) {
    // An ellipse is measured by the box it is inscribed in — the two numbers
    // its properties state, and the two a drawing is dimensioned by.
    case 'rectangle':
    case 'ellipse':
      drawRectangleDimensions(ctx, viewport, shape, meterUnit, style);
      break;
    case 'circle':
      drawCircleDimensions(ctx, viewport, shape, meterUnit, style);
      break;
    default:
      assertNever(shape);
  }

  ctx.restore();
}

function drawRectangleDimensions(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  rectangle: BoxedShape,
  meterUnit: string,
  style: DimensionsStyle
): void {
  const halfWidth = rectangle.width / 2;
  const halfLength = rectangle.length / 2;

  drawMeasuredEdge(ctx, {
    start: planToScreen(
      viewport,
      rectangleLocalToPlan(rectangle, { x: -halfWidth, y: -halfLength })
    ),
    end: planToScreen(viewport, rectangleLocalToPlan(rectangle, { x: halfWidth, y: -halfLength })),
    outward: planDirectionToScreen(rectangleLocalDirection(rectangle, { x: 0, y: -1 })),
    text: formatMeters(rectangle.width, meterUnit),
    textColor: style.textColor,
  });

  drawMeasuredEdge(ctx, {
    start: planToScreen(
      viewport,
      rectangleLocalToPlan(rectangle, { x: halfWidth, y: -halfLength })
    ),
    end: planToScreen(viewport, rectangleLocalToPlan(rectangle, { x: halfWidth, y: halfLength })),
    outward: planDirectionToScreen(rectangleLocalDirection(rectangle, { x: 1, y: 0 })),
    text: formatMeters(rectangle.length, meterUnit),
    textColor: style.textColor,
  });
}

function drawCircleDimensions(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  circle: CircleShape,
  meterUnit: string,
  style: DimensionsStyle
): void {
  const center = planToScreen(viewport, circle.center);
  const rim = planToScreen(viewport, { x: circle.center.x + circle.radius, y: circle.center.y });

  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  ctx.lineTo(rim.x, rim.y);
  ctx.moveTo(rim.x, rim.y - DIMENSION_TICK_HALF_PX);
  ctx.lineTo(rim.x, rim.y + DIMENSION_TICK_HALF_PX);
  ctx.stroke();

  drawLabel(
    ctx,
    `${RADIUS_LABEL_PREFIX}${formatMeters(circle.radius, meterUnit)}`,
    midpoint(center, rim),
    style.textColor
  );
}

function drawMeasuredEdge(
  ctx: CanvasRenderingContext2D,
  {
    start,
    end,
    outward,
    text,
    textColor,
  }: {
    readonly start: Vector2;
    readonly end: Vector2;
    readonly outward: Vector2 | undefined;
    readonly text: string;
    readonly textColor: string;
  }
): void {
  const offsetX = (outward?.x ?? 0) * DIMENSION_OFFSET_PX;
  const offsetY = (outward?.y ?? 0) * DIMENSION_OFFSET_PX;
  const lineStart: Vector2 = { x: start.x + offsetX, y: start.y + offsetY };
  const lineEnd: Vector2 = { x: end.x + offsetX, y: end.y + offsetY };
  const tickX = (outward?.x ?? 0) * DIMENSION_TICK_HALF_PX;
  const tickY = (outward?.y ?? 0) * DIMENSION_TICK_HALF_PX;

  ctx.beginPath();
  ctx.moveTo(lineStart.x, lineStart.y);
  ctx.lineTo(lineEnd.x, lineEnd.y);
  ctx.moveTo(lineStart.x - tickX, lineStart.y - tickY);
  ctx.lineTo(lineStart.x + tickX, lineStart.y + tickY);
  ctx.moveTo(lineEnd.x - tickX, lineEnd.y - tickY);
  ctx.lineTo(lineEnd.x + tickX, lineEnd.y + tickY);
  ctx.stroke();

  drawLabel(ctx, text, midpoint(lineStart, lineEnd), textColor);
}

function midpoint(first: Vector2, second: Vector2): Vector2 {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}
