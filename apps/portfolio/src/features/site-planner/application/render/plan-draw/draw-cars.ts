import { CAR_LENGTH_METERS, CAR_WIDTH_METERS } from '../../../domain/constants';
import { carLocalToPlan } from '../../../domain/geometry/car-geometry';
import type { CarId, CarInstance } from '../../../domain/model/plot-objects';
import { DEGREES_TO_RADIANS } from '../../../domain/units';
import type { PlanViewport } from '../../../domain/view/plan-viewport';
import { planToScreen } from '../../../domain/view/plan-viewport';
import type { ShapeHandle } from './draw-selection';
import { drawHandles, ROTATION_HANDLE_GAP_PX } from './draw-selection';
import { PLAN_COLORS } from './shared';

const BODY_LINE_WIDTH_PX = 1.4;
const SELECTED_LINE_WIDTH_PX = 2.2;
/** Rounded corners, as a fraction of the car's width — a car has no sharp ones. */
const CORNER_RADIUS_FRACTION = 0.28;
/** How far into the body the nose marker reaches, as a fraction of the length. */
const NOSE_LENGTH_FRACTION = 0.18;
const HALF = 0.5;

export interface CarStyle {
  readonly fillColor: string;
  readonly strokeColor: string;
  readonly selectedColor: string;
}

const DEFAULT_CAR_STYLE: CarStyle = {
  fillColor: PLAN_COLORS.carFill,
  strokeColor: PLAN_COLORS.carStroke,
  selectedColor: PLAN_COLORS.selectionStroke,
};

/**
 * Where the selected car is turned by: one grip, standing a fixed pixel gap
 * ahead of its nose. Exported on its own because the pointer layer hit-tests
 * exactly the handle that is drawn — one computation feeds both, as it does for
 * the shapes.
 */
export function computeCarHandles(
  car: CarInstance,
  viewport: PlanViewport
): readonly ShapeHandle[] {
  const nose = planToScreen(viewport, carLocalToPlan(car, { x: CAR_LENGTH_METERS * HALF, y: 0 }));
  const heading = screenHeading(car.rotationDegrees);

  return [
    {
      kind: 'rotate',
      screenPoint: {
        x: nose.x + heading.x * ROTATION_HANDLE_GAP_PX,
        y: nose.y + heading.y * ROTATION_HANDLE_GAP_PX,
      },
    },
  ];
}

/**
 * Parked cars, drawn as what they are on a site plan: a rounded 4.5 × 1.8 m
 * rectangle with the nose marked, so a drive can be read for the room it leaves
 * and for the way the car stands in it.
 */
export function drawCars(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  {
    cars,
    selectedCarId,
  }: {
    readonly cars: readonly CarInstance[];
    readonly selectedCarId: CarId | undefined;
  },
  style: CarStyle = DEFAULT_CAR_STYLE
): void {
  if (cars.length === 0) {
    return;
  }

  for (const car of cars) {
    const isSelected = car.id === selectedCarId;

    ctx.save();
    withCarFrame(ctx, viewport, car);

    const lengthPx = CAR_LENGTH_METERS * viewport.pixelsPerMeter;
    const widthPx = CAR_WIDTH_METERS * viewport.pixelsPerMeter;

    ctx.beginPath();
    ctx.roundRect(
      -lengthPx * HALF,
      -widthPx * HALF,
      lengthPx,
      widthPx,
      widthPx * CORNER_RADIUS_FRACTION
    );
    ctx.fillStyle = style.fillColor;
    ctx.fill();
    ctx.strokeStyle = isSelected ? style.selectedColor : style.strokeColor;
    ctx.lineWidth = isSelected ? SELECTED_LINE_WIDTH_PX : BODY_LINE_WIDTH_PX;
    ctx.stroke();

    drawNose(ctx, lengthPx, widthPx);
    ctx.restore();
  }
}

/** The grip the selected car is turned by; the editor draws it, a sheet does not. */
export function drawCarSelection(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  car: CarInstance
): void {
  drawHandles(ctx, computeCarHandles(car, viewport));
}

/**
 * Puts the canvas into the car's own frame: the origin at the car, `x` running
 * along its length towards the nose. Plan `y` runs north while screen `y` runs
 * down, so the plan's counter-clockwise turn is a clockwise one here.
 */
function withCarFrame(
  ctx: CanvasRenderingContext2D,
  viewport: PlanViewport,
  car: CarInstance
): void {
  const screenPoint = planToScreen(viewport, car.position);

  ctx.translate(screenPoint.x, screenPoint.y);
  ctx.rotate(-car.rotationDegrees * DEGREES_TO_RADIANS);
}

/** A chevron across the bonnet: which end of the body the car is pointing with. */
function drawNose(ctx: CanvasRenderingContext2D, lengthPx: number, widthPx: number): void {
  const noseX = lengthPx * HALF;
  const baseX = noseX - lengthPx * NOSE_LENGTH_FRACTION;

  ctx.beginPath();
  ctx.moveTo(baseX, -widthPx * HALF);
  ctx.lineTo(noseX, 0);
  ctx.lineTo(baseX, widthPx * HALF);
  ctx.stroke();
}

/** Unit screen direction the car's nose points in. */
function screenHeading(rotationDegrees: number): { readonly x: number; readonly y: number } {
  const angle = rotationDegrees * DEGREES_TO_RADIANS;

  return { x: Math.cos(angle), y: -Math.sin(angle) };
}
