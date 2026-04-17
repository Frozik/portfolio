import { describe, expect, it } from 'vitest';
import {
  isCollinearWithLine,
  isPointOnInfiniteLine,
  isPointOnSegment,
  positionsMatch,
  projectPointOntoLine,
} from './geometry-utils';
import type { Vec3Array } from './topology-types';

describe('positionsMatch', () => {
  it('returns true for identical positions', () => {
    expect(positionsMatch([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it('returns true for positions within default epsilon', () => {
    expect(positionsMatch([1, 2, 3], [1, 2, 3.000000001])).toBe(true);
  });

  it('returns false for positions outside default epsilon', () => {
    expect(positionsMatch([1, 2, 3], [1, 2, 3.01])).toBe(false);
  });

  it('uses custom epsilon squared when provided', () => {
    // distSq([0,0,0], [0.05,0,0]) = 0.0025
    expect(positionsMatch([0, 0, 0], [0.05, 0, 0], 0.001)).toBe(false);
    expect(positionsMatch([0, 0, 0], [0.05, 0, 0], 0.01)).toBe(true);
  });
});

describe('projectPointOntoLine', () => {
  it('returns undefined for degenerate (zero-length) line', () => {
    expect(projectPointOntoLine([5, 5, 5], [1, 1, 1], [1, 1, 1])).toBeUndefined();
  });

  it('projects point at start onto parameter 0', () => {
    const result = projectPointOntoLine([0, 0, 0], [0, 0, 0], [10, 0, 0]);
    expect(result).toBeDefined();
    expect(result?.parameter).toBeCloseTo(0);
    expect(result?.distanceSquared).toBeCloseTo(0);
  });

  it('projects point at end onto parameter 1', () => {
    const result = projectPointOntoLine([10, 0, 0], [0, 0, 0], [10, 0, 0]);
    expect(result).toBeDefined();
    expect(result?.parameter).toBeCloseTo(1);
    expect(result?.distanceSquared).toBeCloseTo(0);
  });

  it('projects midpoint onto parameter 0.5', () => {
    const result = projectPointOntoLine([5, 0, 0], [0, 0, 0], [10, 0, 0]);
    expect(result).toBeDefined();
    expect(result?.parameter).toBeCloseTo(0.5);
    expect(result?.distanceSquared).toBeCloseTo(0);
  });

  it('returns correct distance for off-line point', () => {
    const result = projectPointOntoLine([5, 3, 0], [0, 0, 0], [10, 0, 0]);
    expect(result).toBeDefined();
    expect(result?.parameter).toBeCloseTo(0.5);
    expect(result?.distanceSquared).toBeCloseTo(9);
  });

  it('allows negative parameter for points behind start', () => {
    const result = projectPointOntoLine([-5, 0, 0], [0, 0, 0], [10, 0, 0]);
    expect(result).toBeDefined();
    expect(result?.parameter).toBeCloseTo(-0.5);
  });
});

describe('isPointOnInfiniteLine', () => {
  const lineStart: Vec3Array = [0, 0, 0];
  const lineEnd: Vec3Array = [10, 0, 0];

  it('returns true for point on the line', () => {
    expect(isPointOnInfiniteLine([5, 0, 0], lineStart, lineEnd)).toBe(true);
  });

  it('returns true for point on the extension beyond end', () => {
    expect(isPointOnInfiniteLine([20, 0, 0], lineStart, lineEnd)).toBe(true);
  });

  it('returns true for point on the extension before start', () => {
    expect(isPointOnInfiniteLine([-10, 0, 0], lineStart, lineEnd)).toBe(true);
  });

  it('returns false for point far off the line', () => {
    expect(isPointOnInfiniteLine([5, 1, 0], lineStart, lineEnd)).toBe(false);
  });

  it('returns true for degenerate line when point matches start', () => {
    expect(isPointOnInfiniteLine([1, 1, 1], [1, 1, 1], [1, 1, 1])).toBe(true);
  });
});

describe('isPointOnSegment', () => {
  const segmentStart: Vec3Array = [0, 0, 0];
  const segmentEnd: Vec3Array = [10, 0, 0];

  it('returns true for point on the segment', () => {
    expect(isPointOnSegment([5, 0, 0], segmentStart, segmentEnd)).toBe(true);
  });

  it('returns true for point at start endpoint', () => {
    expect(isPointOnSegment([0, 0, 0], segmentStart, segmentEnd)).toBe(true);
  });

  it('returns true for point at end endpoint', () => {
    expect(isPointOnSegment([10, 0, 0], segmentStart, segmentEnd)).toBe(true);
  });

  it('returns false for point beyond end', () => {
    expect(isPointOnSegment([20, 0, 0], segmentStart, segmentEnd)).toBe(false);
  });

  it('returns false for point before start', () => {
    expect(isPointOnSegment([-10, 0, 0], segmentStart, segmentEnd)).toBe(false);
  });

  it('returns false for point off the segment laterally', () => {
    expect(isPointOnSegment([5, 1, 0], segmentStart, segmentEnd)).toBe(false);
  });
});

describe('isCollinearWithLine', () => {
  it('returns true for segment on the same line', () => {
    expect(isCollinearWithLine([2, 0, 0], [5, 0, 0], [0, 0, 0], [10, 0, 0])).toBe(true);
  });

  it('returns true for segment on the extension', () => {
    expect(isCollinearWithLine([15, 0, 0], [20, 0, 0], [0, 0, 0], [10, 0, 0])).toBe(true);
  });

  it('returns false for parallel but offset segment', () => {
    expect(isCollinearWithLine([0, 1, 0], [10, 1, 0], [0, 0, 0], [10, 0, 0])).toBe(false);
  });

  it('returns false for perpendicular segment', () => {
    expect(isCollinearWithLine([5, -5, 0], [5, 5, 0], [0, 0, 0], [10, 0, 0])).toBe(false);
  });

  it('returns false for zero-length line', () => {
    expect(isCollinearWithLine([0, 0, 0], [1, 0, 0], [5, 5, 5], [5, 5, 5])).toBe(false);
  });

  it('works with diagonal lines', () => {
    expect(isCollinearWithLine([2, 2, 2], [4, 4, 4], [0, 0, 0], [1, 1, 1])).toBe(true);
    expect(isCollinearWithLine([2, 2, 3], [4, 4, 4], [0, 0, 0], [1, 1, 1])).toBe(false);
  });

  it('returns true for self-collinearity on a non-axis-aligned edge (regression)', () => {
    // Pentagonal-pyramid edge #7 from puzzle-1-1 — the exact case where Float32
    // cross-product precision produced a false negative for collinearity.
    const edgeStart: Vec3Array = [-0.587785, -0.75, -0.809017];
    const edgeEnd: Vec3Array = [-0.951057, -0.75, 0.309017];
    expect(isCollinearWithLine(edgeStart, edgeEnd, edgeStart, edgeEnd)).toBe(true);
  });
});
