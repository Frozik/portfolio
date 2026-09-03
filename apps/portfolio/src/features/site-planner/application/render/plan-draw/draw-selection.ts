import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import type { RotatedFrame } from '../../../domain/geometry/polygonize-shape';
import {
  polygonizeShape,
  rectangleLocalDirection,
  rectangleLocalToPlan,
} from '../../../domain/geometry/polygonize-shape';
import { anchorPlanPosition } from '../../../domain/geometry/shape-anchor';
import type {
  RectangleHandleFactors,
  RotatedRectangle,
} from '../../../domain/geometry/transform-shape';
import type { CircleShape, Shape } from '../../../domain/model/shapes';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planDirectionToScreen, planToScreen } from '../../../domain/view/plan-viewport';
import { buildRingPath, PLAN_COLORS } from './shared';

/**
 * Names address the rectangle's own frame *before* rotation: `top` is the far
 * end of its length, `right` the far end of its width. A rotated rectangle keeps
 * the same handle names, which is what lets a resize gesture stay parametric.
 */
export type RectangleHandleKind =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left';

export type ShapeHandleKind = RectangleHandleKind | 'rotate' | 'center' | 'radius';

export interface ShapeHandle {
  readonly kind: ShapeHandleKind;
  /** CSS pixels, canvas-relative — the same space the pointer reports in. */
  readonly screenPoint: Vector2;
}

export const HANDLE_SIZE_PX = 8;
/** Gap between the top edge of a rectangle and its rotation handle. */
export const ROTATION_HANDLE_GAP_PX = 24;

const SELECTION_LINE_WIDTH_PX = 1.5;
const HANDLE_LINE_WIDTH_PX = 1;
const ROTATION_HANDLE_RADIUS_PX = HANDLE_SIZE_PX / 2;
const FULL_CIRCLE_RADIANS = 2 * Math.PI;

const RECTANGLE_HANDLE_LOCAL_FACTORS: readonly (RectangleHandleFactors & {
  readonly kind: RectangleHandleKind;
})[] = [
  { kind: 'top-left', widthFactor: -0.5, lengthFactor: 0.5 },
  { kind: 'top', widthFactor: 0, lengthFactor: 0.5 },
  { kind: 'top-right', widthFactor: 0.5, lengthFactor: 0.5 },
  { kind: 'right', widthFactor: 0.5, lengthFactor: 0 },
  { kind: 'bottom-right', widthFactor: 0.5, lengthFactor: -0.5 },
  { kind: 'bottom', widthFactor: 0, lengthFactor: -0.5 },
  { kind: 'bottom-left', widthFactor: -0.5, lengthFactor: -0.5 },
  { kind: 'left', widthFactor: -0.5, lengthFactor: 0 },
];

export interface SelectionStyle {
  readonly outlineColor: string;
  readonly handleFillColor: string;
  readonly handleStrokeColor: string;
}

export const DEFAULT_SELECTION_STYLE: SelectionStyle = {
  outlineColor: PLAN_COLORS.selectionStroke,
  handleFillColor: PLAN_COLORS.handleFill,
  handleStrokeColor: PLAN_COLORS.handleStroke,
};

/**
 * Screen positions of every manipulator of the selected shape. Exported on its
 * own because the pointer layer hit-tests exactly the handles that are drawn —
 * one computation feeds both, so the two can never disagree.
 */
export function computeShapeHandles(shape: Shape, viewport: PlanViewport): readonly ShapeHandle[] {
  switch (shape.kind) {
    case 'rectangle':
    case 'ellipse':
      return computeRotatedRectangleHandles(shape, viewport);
    case 'circle':
      return computeCircleHandles(shape, viewport);
    default:
      return assertNever(shape);
  }
}

/**
 * Where the named handle sits in the rectangle's own frame, or `undefined` for a
 * handle that resizes nothing. Shares the table the handles are drawn from, so a
 * resize gesture can never act on a different corner than the one grabbed.
 */
export function rectangleHandleFactors(kind: ShapeHandleKind): RectangleHandleFactors | undefined {
  return RECTANGLE_HANDLE_LOCAL_FACTORS.find(entry => entry.kind === kind);
}

/** Outline of the selected shape plus its manipulators and its anchor mark. */
export function drawSelection(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  shape: Shape,
  style: SelectionStyle = DEFAULT_SELECTION_STYLE
): void {
  const handles = computeShapeHandles(shape, viewport);

  ctx.save();
  ctx.strokeStyle = style.outlineColor;
  ctx.lineWidth = SELECTION_LINE_WIDTH_PX;
  ctx.stroke(buildRingPath(polygonizeShape(shape), viewport));

  drawRotationStem(ctx, handles);
  drawHandles(ctx, handles, style);
  drawAnchorMark(ctx, planToScreen(viewport, anchorPlanPosition(shape)));

  ctx.restore();
}

const ANCHOR_RING_RADIUS_PX = 5;
const ANCHOR_CROSS_ARM_PX = 8;
const ANCHOR_LINE_WIDTH_PX = 1.2;

/**
 * The anchor as every transform tool draws it: a ring with a cross through it.
 * Distinct on purpose from every square and dot on the plan — this is the one
 * mark that stands for a point of reference rather than a thing to resize.
 */
function drawAnchorMark(ctx: CanvasRenderingContext2D, screenPoint: Vector2): void {
  const { x, y } = screenPoint;

  ctx.save();
  ctx.strokeStyle = PLAN_COLORS.boundaryStroke;
  ctx.lineWidth = ANCHOR_LINE_WIDTH_PX;

  ctx.beginPath();
  ctx.arc(x, y, ANCHOR_RING_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - ANCHOR_CROSS_ARM_PX, y);
  ctx.lineTo(x + ANCHOR_CROSS_ARM_PX, y);
  ctx.moveTo(x, y - ANCHOR_CROSS_ARM_PX);
  ctx.lineTo(x, y + ANCHOR_CROSS_ARM_PX);
  ctx.stroke();

  ctx.restore();
}

/**
 * The manipulators themselves. Shared with the objects that carry a handle
 * without being a shape — a parked car and its rotation grip — so every handle
 * on the plan is drawn by one piece of code and reads the same.
 */
export function drawHandles(
  ctx: CanvasRenderingContext2D,
  handles: readonly ShapeHandle[],
  style: SelectionStyle = DEFAULT_SELECTION_STYLE
): void {
  ctx.save();
  ctx.lineWidth = HANDLE_LINE_WIDTH_PX;
  ctx.fillStyle = style.handleFillColor;
  ctx.strokeStyle = style.handleStrokeColor;

  for (const handle of handles) {
    drawHandle(ctx, handle);
  }

  ctx.restore();
}

/**
 * The eight edge grips of a rotated rectangle and the turn grip past its local
 * north — shared by drawn shapes and by floor slabs, so both are manipulated by
 * the very same grips in the very same places.
 */
export function computeRotatedRectangleHandles(
  rectangle: RotatedRectangle,
  viewport: PlanViewport
): readonly ShapeHandle[] {
  const handles: ShapeHandle[] = RECTANGLE_HANDLE_LOCAL_FACTORS.map(
    ({ kind, widthFactor, lengthFactor }) => ({
      kind,
      screenPoint: planToScreen(
        viewport,
        rectangleLocalToPlan(rectangle, {
          x: widthFactor * rectangle.width,
          y: lengthFactor * rectangle.length,
        })
      ),
    })
  );

  const topHandle = handles.find(handle => handle.kind === 'top');

  if (topHandle !== undefined) {
    handles.push({
      kind: 'rotate',
      screenPoint: offsetAlongLocalNorth(rectangle, topHandle.screenPoint),
    });
  }

  return handles;
}

function computeCircleHandles(circle: CircleShape, viewport: PlanViewport): readonly ShapeHandle[] {
  return [
    { kind: 'center', screenPoint: planToScreen(viewport, circle.center) },
    {
      kind: 'radius',
      screenPoint: planToScreen(viewport, {
        x: circle.center.x + circle.radius,
        y: circle.center.y,
      }),
    },
  ];
}

/**
 * The rotation handle sits a fixed number of pixels beyond the top edge, along
 * the rectangle's own north. The bearing comes from the unit local axis rather
 * than from the centre-to-edge vector, so it stays defined for a shape whose
 * length has been dragged down to zero.
 */
function offsetAlongLocalNorth(rectangle: RotatedFrame, topScreenPoint: Vector2): Vector2 {
  const direction = planDirectionToScreen(rectangleLocalDirection(rectangle, { x: 0, y: 1 }));

  if (direction === undefined) {
    return { x: topScreenPoint.x, y: topScreenPoint.y - ROTATION_HANDLE_GAP_PX };
  }

  return {
    x: topScreenPoint.x + direction.x * ROTATION_HANDLE_GAP_PX,
    y: topScreenPoint.y + direction.y * ROTATION_HANDLE_GAP_PX,
  };
}

function drawRotationStem(ctx: CanvasRenderingContext2D, handles: readonly ShapeHandle[]): void {
  const topHandle = handles.find(handle => handle.kind === 'top');
  const rotateHandle = handles.find(handle => handle.kind === 'rotate');

  if (topHandle === undefined || rotateHandle === undefined) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(topHandle.screenPoint.x, topHandle.screenPoint.y);
  ctx.lineTo(rotateHandle.screenPoint.x, rotateHandle.screenPoint.y);
  ctx.stroke();
}

function drawHandle(ctx: CanvasRenderingContext2D, handle: ShapeHandle): void {
  const { x, y } = handle.screenPoint;

  if (handle.kind === 'rotate' || handle.kind === 'center') {
    ctx.beginPath();
    ctx.arc(x, y, ROTATION_HANDLE_RADIUS_PX, 0, FULL_CIRCLE_RADIANS);
    ctx.fill();
    ctx.stroke();

    return;
  }

  ctx.fillRect(x - HANDLE_SIZE_PX / 2, y - HANDLE_SIZE_PX / 2, HANDLE_SIZE_PX, HANDLE_SIZE_PX);
  ctx.strokeRect(x - HANDLE_SIZE_PX / 2, y - HANDLE_SIZE_PX / 2, HANDLE_SIZE_PX, HANDLE_SIZE_PX);
}
