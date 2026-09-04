import {
  MAX_SHAPE_BUFFER_COUNT,
  SHAPE_FADE_DURATION,
  SHAPE_MIN_BRIGHTNESS,
} from './chart-constants';
import type { ShapeBounds } from './chart-shapes';
import {
  computeShapeCount,
  ensureMinimumBrightness,
  getShapeLifetime,
  replaceExpiredShapes,
  resizeShapes,
  spawnShape,
  spawnStaggeredShapes,
} from './chart-shapes';

const BOUNDS: ShapeBounds = { halfWidth: 500, halfHeight: 300 };

/** Deterministic `[0, 1)` sequence cycling through the given values. */
function sequence(values: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index++;
    return value;
  };
}

describe('shapes', () => {
  it('spawns shapes fully inside the bounds', () => {
    for (const roll of [0, 0.5, 0.999]) {
      const shape = spawnShape(0, BOUNDS, sequence([roll]));
      expect(Math.abs(shape.x) + shape.halfSize).toBeLessThanOrEqual(BOUNDS.halfWidth);
      expect(Math.abs(shape.y) + shape.halfSize).toBeLessThanOrEqual(BOUNDS.halfHeight);
    }
  });

  it('lifts a too-dark colour up to the minimum brightness without clipping a black one', () => {
    const lifted = ensureMinimumBrightness({ r: 0.1, g: 0.1, b: 0.1 });
    const average = (lifted.r + lifted.g + lifted.b) / 3;
    expect(average).toBeCloseTo(SHAPE_MIN_BRIGHTNESS, 6);

    const black = ensureMinimumBrightness({ r: 0, g: 0, b: 0 });
    expect(black).toEqual({ r: 0, g: 0, b: 0 });

    const bright = { r: 0.9, g: 0.8, b: 0.7 };
    expect(ensureMinimumBrightness(bright)).toBe(bright);
  });

  it('derives the shape count from the CSS area, capped by the buffer size', () => {
    expect(computeShapeCount(1920, 1080, 1)).toBe(207);
    expect(computeShapeCount(1920 * 2, 1080 * 2, 2)).toBe(207);
    expect(computeShapeCount(10, 10, 1)).toBe(1);
    expect(computeShapeCount(1e6, 1e6, 1)).toBe(MAX_SHAPE_BUFFER_COUNT);
  });

  it('staggers spawn times backwards so a fresh population fades in gradually', () => {
    const shapes = spawnStaggeredShapes(4, 10, BOUNDS, sequence([0.5]));
    const spawnTimes = shapes.map(shape => shape.spawnTime);

    expect(spawnTimes[0]).toBe(10);
    expect(spawnTimes).toEqual([...spawnTimes].sort((left, right) => right - left));
    expect(new Set(spawnTimes).size).toBe(4);
  });

  it('resizes by keeping the survivors and appending or trimming, never mutating the input', () => {
    const initial = spawnStaggeredShapes(3, 0, BOUNDS, sequence([0.5]));

    const grown = resizeShapes(initial, 5, 1, BOUNDS, sequence([0.5]));
    expect(grown.slice(0, 3)).toEqual(initial);
    expect(grown).toHaveLength(5);

    const trimmed = resizeShapes(initial, 2, 1, BOUNDS);
    expect(trimmed).toEqual(initial.slice(0, 2));
    expect(initial).toHaveLength(3);
  });

  it('replaces only the shapes whose lifetime has run out', () => {
    const shapes = spawnStaggeredShapes(2, 0, BOUNDS, sequence([0.5]));
    const [fresh, older] = shapes;
    // `older` was spawned before `fresh`, so it is the first to run past its lifetime.
    const now = getShapeLifetime(older) + older.spawnTime + SHAPE_FADE_DURATION / 10;

    const next = replaceExpiredShapes(shapes, now, BOUNDS, sequence([0.5]));

    expect(next[0]).toBe(fresh);
    expect(next[1]).not.toBe(older);
    expect(next[1]?.spawnTime).toBe(now);
  });
});
