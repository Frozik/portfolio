import { random } from 'lodash-es';

import type { IFxDrawContext } from '../types';

const SHAPE_COUNT = 14;
const SIZE_MIN = 0.03;
const SIZE_RANGE = 0.05;
const SIDES_MIN = 3;
const SIDES_MAX = 7;
const DRIFT_SPEED = 0.08;
const SPIN_SPEED = 1.2;
const RANDOM_CENTER = 0.5;
const FILL_ALPHA = 0.35;
const STROKE_ALPHA = 0.8;
const LINE_WIDTH_PX = 1.2;

/** Position and size are fractions of the canvas, so shapes survive a resize. */
interface IFloatingShape {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly sides: number;
  readonly rotation: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly angularVelocity: number;
  readonly filled: boolean;
}

export type FloatingShapesState = { shapes: readonly IFloatingShape[] };

export function createShapesState(): FloatingShapesState {
  return {
    shapes: Array.from({ length: SHAPE_COUNT }, () => ({
      x: random(0, 1, true),
      y: random(0, 1, true),
      size: SIZE_MIN + random(0, 1, true) * SIZE_RANGE,
      sides: random(SIDES_MIN, SIDES_MAX),
      rotation: random(0, Math.PI * 2, true),
      velocityX: (random(0, 1, true) - RANDOM_CENTER) * DRIFT_SPEED,
      velocityY: (random(0, 1, true) - RANDOM_CENTER) * DRIFT_SPEED,
      angularVelocity: (random(0, 1, true) - RANDOM_CENTER) * SPIN_SPEED,
      filled: random(0, 1, true) > RANDOM_CENTER,
    })),
  };
}

/** One frame of drift; a shape leaving the canvas bounces back. */
function advanceShape(shape: IFloatingShape, deltaTime: number): IFloatingShape {
  const x = shape.x + shape.velocityX * deltaTime;
  const y = shape.y + shape.velocityY * deltaTime;
  return {
    ...shape,
    x,
    y,
    rotation: shape.rotation + shape.angularVelocity * deltaTime,
    velocityX: x < 0 || x > 1 ? -shape.velocityX : shape.velocityX,
    velocityY: y < 0 || y > 1 ? -shape.velocityY : shape.velocityY,
  };
}

export function drawShapes(
  { ctx, width, height, deltaTime, accent, devicePixelRatio }: IFxDrawContext,
  state: FloatingShapesState
): void {
  state.shapes = state.shapes.map(shape => advanceShape(shape, deltaTime));

  for (const shape of state.shapes) {
    const radius = shape.size * Math.min(width, height);
    ctx.save();
    ctx.translate(shape.x * width, shape.y * height);
    ctx.rotate(shape.rotation);
    ctx.beginPath();
    for (let vertexIndex = 0; vertexIndex <= shape.sides; vertexIndex++) {
      const angle = (vertexIndex / shape.sides) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (vertexIndex === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (shape.filled) {
      ctx.fillStyle = accent(FILL_ALPHA);
      ctx.fill();
    }
    ctx.strokeStyle = accent(STROKE_ALPHA);
    ctx.lineWidth = LINE_WIDTH_PX * devicePixelRatio;
    ctx.stroke();
    ctx.restore();
  }
}
