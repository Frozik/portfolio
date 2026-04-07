import {
  HALF,
  MAX_SHAPE_BUFFER_COUNT,
  SHAPE_DENSITY,
  SHAPE_FADE_DURATION,
  SHAPE_HOLD_DURATION_MAX,
  SHAPE_HOLD_DURATION_MIN,
  SHAPE_INSTANCE_BYTES,
  SHAPE_MIN_BRIGHTNESS,
  SHAPE_OPACITY_MAX,
  SHAPE_OPACITY_MIN,
  SHAPE_SIZE_MAX,
  SHAPE_SIZE_MIN,
  SHAPE_TYPE_COUNT,
} from './chart-constants';

export interface ShapeInstance {
  x: number;
  y: number;
  halfSize: number;
  spawnTime: number;
  r: number;
  g: number;
  b: number;
  holdDuration: number;
  shapeType: number;
  fillMode: number;
  maxOpacity: number;
}

export function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function spawnShape(time: number): ShapeInstance {
  let r = Math.random();
  let g = Math.random();
  let b = Math.random();
  // Ensure minimum brightness
  const brightness = (r + g + b) / 3;
  if (brightness < SHAPE_MIN_BRIGHTNESS) {
    const boost = SHAPE_MIN_BRIGHTNESS / Math.max(brightness, 0.01);
    r = Math.min(1, r * boost);
    g = Math.min(1, g * boost);
    b = Math.min(1, b * boost);
  }

  return {
    x: 0,
    y: 0,
    halfSize: randomInRange(SHAPE_SIZE_MIN / 2, SHAPE_SIZE_MAX / 2),
    spawnTime: time,
    r,
    g,
    b,
    holdDuration: randomInRange(SHAPE_HOLD_DURATION_MIN, SHAPE_HOLD_DURATION_MAX),
    shapeType: Math.floor(Math.random() * SHAPE_TYPE_COUNT),
    fillMode: Math.random() < HALF ? 0 : 1,
    maxOpacity: randomInRange(SHAPE_OPACITY_MIN, SHAPE_OPACITY_MAX),
  };
}

export function getShapeLifetime(shape: ShapeInstance): number {
  return 2 * SHAPE_FADE_DURATION + shape.holdDuration;
}

export function writeShapeToBuffer(
  shape: ShapeInstance,
  buffer: Float32Array,
  offset: number
): void {
  const FLOATS_PER_VEC4 = 4;
  // vec4 0: x, y, halfSize, spawnTime
  buffer[offset] = shape.x;
  buffer[offset + 1] = shape.y;
  buffer[offset + 2] = shape.halfSize;
  buffer[offset + 3] = shape.spawnTime;
  // vec4 1: r, g, b, holdDuration
  buffer[offset + FLOATS_PER_VEC4] = shape.r;
  buffer[offset + FLOATS_PER_VEC4 + 1] = shape.g;
  buffer[offset + FLOATS_PER_VEC4 + 2] = shape.b;
  buffer[offset + FLOATS_PER_VEC4 + 3] = shape.holdDuration;
  // vec4 2: shapeType, fillMode, maxOpacity, 0
  const VEC4_2_OFFSET = FLOATS_PER_VEC4 * 2;
  buffer[offset + VEC4_2_OFFSET] = shape.shapeType;
  buffer[offset + VEC4_2_OFFSET + 1] = shape.fillMode;
  buffer[offset + VEC4_2_OFFSET + 2] = shape.maxOpacity;
  buffer[offset + VEC4_2_OFFSET + 3] = 0;
}

export function computeShapeCount(canvasWidth: number, canvasHeight: number): number {
  return Math.min(
    Math.max(1, Math.round(canvasWidth * canvasHeight * SHAPE_DENSITY)),
    MAX_SHAPE_BUFFER_COUNT
  );
}

export function initializeShapes(count: number): ShapeInstance[] {
  const shapes: ShapeInstance[] = [];
  const averageLifetime =
    2 * SHAPE_FADE_DURATION + (SHAPE_HOLD_DURATION_MIN + SHAPE_HOLD_DURATION_MAX) / 2;

  for (let i = 0; i < count; i++) {
    const shape = spawnShape(0);
    // Stagger spawn times so shapes don't all appear at once
    shape.spawnTime = -(averageLifetime / count) * i;
    shapes.push(shape);
  }

  return shapes;
}

export function resizeShapes(
  shapes: ShapeInstance[],
  newCount: number,
  time: number,
  halfW: number,
  halfH: number
): void {
  if (newCount > shapes.length) {
    const averageLifetime =
      2 * SHAPE_FADE_DURATION + (SHAPE_HOLD_DURATION_MIN + SHAPE_HOLD_DURATION_MAX) / 2;
    const addCount = newCount - shapes.length;

    for (let i = 0; i < addCount; i++) {
      const shape = spawnShape(time);
      // Stagger spawn times so new shapes fade in gradually
      shape.spawnTime = time - (averageLifetime / addCount) * i;
      shape.x = randomInRange(-halfW + shape.halfSize, halfW - shape.halfSize);
      shape.y = randomInRange(-halfH + shape.halfSize, halfH - shape.halfSize);
      shapes.push(shape);
    }
  } else if (newCount < shapes.length) {
    shapes.splice(newCount);
  }
}

export function createShapeDataBuffer(count: number): Float32Array {
  return new Float32Array((count * SHAPE_INSTANCE_BYTES) / Float32Array.BYTES_PER_ELEMENT);
}
