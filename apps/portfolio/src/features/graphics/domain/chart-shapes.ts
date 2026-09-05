import {
  MAX_SHAPE_BUFFER_COUNT,
  SHAPE_BRIGHTNESS_EPSILON,
  SHAPE_DENSITY,
  SHAPE_FADE_DURATION,
  SHAPE_HOLD_DURATION_MAX,
  SHAPE_HOLD_DURATION_MIN,
  SHAPE_MIN_BRIGHTNESS,
  SHAPE_OPACITY_MAX,
  SHAPE_OPACITY_MIN,
  SHAPE_SIZE_MAX,
  SHAPE_SIZE_MIN,
} from './chart-constants';

/** In shader order: the index of a name is the shape id the shader switches on. */
export const SHAPE_TYPES = [
  'circle',
  'square',
  'rhombus',
  'pentagon',
  'hexagon',
  'star',
  'triangleUp',
  'triangleDown',
  'triangleLeft',
  'triangleRight',
] as const;

type ShapeType = (typeof SHAPE_TYPES)[number];
export type ShapeFillMode = 'solid' | 'outline';

export interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface ShapeInstance {
  readonly x: number;
  readonly y: number;
  readonly halfSize: number;
  readonly spawnTime: number;
  readonly color: RgbColor;
  readonly holdDuration: number;
  readonly shapeType: ShapeType;
  readonly fillMode: ShapeFillMode;
  readonly maxOpacity: number;
}

/** Half extents of the canvas in device pixels; shapes spawn fully inside them. */
export interface ShapeBounds {
  readonly halfWidth: number;
  readonly halfHeight: number;
}

/** Uniform `[0, 1)` source, injectable so spawning is deterministic under test. */
export type RandomSource = () => number;

const RGB_CHANNEL_COUNT = 3;
const AVERAGE_LIFETIME =
  2 * SHAPE_FADE_DURATION + (SHAPE_HOLD_DURATION_MIN + SHAPE_HOLD_DURATION_MAX) / 2;

function randomInRange(random: RandomSource, min: number, max: number): number {
  return min + random() * (max - min);
}

function pickRandom<T>(random: RandomSource, options: readonly T[]): T {
  return options[Math.floor(random() * options.length)];
}

export function ensureMinimumBrightness(color: RgbColor): RgbColor {
  const brightness = (color.r + color.g + color.b) / RGB_CHANNEL_COUNT;
  if (brightness >= SHAPE_MIN_BRIGHTNESS) {
    return color;
  }
  const boost = SHAPE_MIN_BRIGHTNESS / Math.max(brightness, SHAPE_BRIGHTNESS_EPSILON);
  return {
    r: Math.min(1, color.r * boost),
    g: Math.min(1, color.g * boost),
    b: Math.min(1, color.b * boost),
  };
}

export function spawnShape(
  time: number,
  bounds: ShapeBounds,
  random: RandomSource = Math.random
): ShapeInstance {
  const halfSize = randomInRange(random, SHAPE_SIZE_MIN / 2, SHAPE_SIZE_MAX / 2);
  return {
    x: randomInRange(random, -bounds.halfWidth + halfSize, bounds.halfWidth - halfSize),
    y: randomInRange(random, -bounds.halfHeight + halfSize, bounds.halfHeight - halfSize),
    halfSize,
    spawnTime: time,
    color: ensureMinimumBrightness({ r: random(), g: random(), b: random() }),
    holdDuration: randomInRange(random, SHAPE_HOLD_DURATION_MIN, SHAPE_HOLD_DURATION_MAX),
    shapeType: pickRandom(random, SHAPE_TYPES),
    fillMode: pickRandom(random, ['solid', 'outline']),
    maxOpacity: randomInRange(random, SHAPE_OPACITY_MIN, SHAPE_OPACITY_MAX),
  };
}

export function getShapeLifetime(shape: ShapeInstance): number {
  return 2 * SHAPE_FADE_DURATION + shape.holdDuration;
}

/** Shape count from the CSS pixel area, so Retina displays are not flooded. */
export function computeShapeCount(
  canvasWidth: number,
  canvasHeight: number,
  devicePixelRatio: number
): number {
  const cssArea = (canvasWidth / devicePixelRatio) * (canvasHeight / devicePixelRatio);
  return Math.min(Math.max(1, Math.round(cssArea * SHAPE_DENSITY)), MAX_SHAPE_BUFFER_COUNT);
}

/** `count` shapes with spawn times spread back over one average lifetime, so they fade in staggered. */
export function spawnStaggeredShapes(
  count: number,
  time: number,
  bounds: ShapeBounds,
  random: RandomSource = Math.random
): readonly ShapeInstance[] {
  return Array.from({ length: count }, (_, index) =>
    spawnShape(time - (AVERAGE_LIFETIME / count) * index, bounds, random)
  );
}

/** Grows the population with staggered newcomers or trims it to `count`. */
export function resizeShapes(
  shapes: readonly ShapeInstance[],
  count: number,
  time: number,
  bounds: ShapeBounds,
  random: RandomSource = Math.random
): readonly ShapeInstance[] {
  if (count < shapes.length) {
    return shapes.slice(0, count);
  }
  return [...shapes, ...spawnStaggeredShapes(count - shapes.length, time, bounds, random)];
}

/** Replaces every shape whose lifetime has run out with a fresh one spawned now. */
export function replaceExpiredShapes(
  shapes: readonly ShapeInstance[],
  time: number,
  bounds: ShapeBounds,
  random: RandomSource = Math.random
): readonly ShapeInstance[] {
  return shapes.map(shape =>
    time - shape.spawnTime > getShapeLifetime(shape) ? spawnShape(time, bounds, random) : shape
  );
}
