import { describe, expect, it } from 'vitest';

import { createCircle, createRectangle } from '../model/shapes';
import { evaluateComposition } from './evaluate-composition';
import type { PolygonWithHoles, Ring, TriangleMesh } from './polygon-types';
import { triangulateMultiPolygon, triangulatePolygon } from './triangulate-polygon';

const AREA_EPSILON = 1e-6;

function signedArea(ring: Ring): number {
  let doubledArea = 0;

  ring.forEach((point, index) => {
    const next = ring[(index + 1) % ring.length];

    doubledArea += point.x * next.y - next.x * point.y;
  });

  return doubledArea / 2;
}

function polygonArea({ outer, holes }: PolygonWithHoles): number {
  return holes.reduce(
    (total, hole) => total - Math.abs(signedArea(hole)),
    Math.abs(signedArea(outer))
  );
}

function meshArea({ positions, indices }: TriangleMesh): number {
  let total = 0;

  for (let triangle = 0; triangle < indices.length; triangle += 3) {
    const [firstX, firstY] = readVertex(positions, indices[triangle]);
    const [secondX, secondY] = readVertex(positions, indices[triangle + 1]);
    const [thirdX, thirdY] = readVertex(positions, indices[triangle + 2]);

    total +=
      Math.abs((secondX - firstX) * (thirdY - firstY) - (thirdX - firstX) * (secondY - firstY)) / 2;
  }

  return total;
}

function readVertex(positions: Float32Array, vertexIndex: number): readonly [number, number] {
  return [positions[vertexIndex * 2], positions[vertexIndex * 2 + 1]];
}

describe('triangulatePolygon', () => {
  it('covers a plain rectangle with two triangles of the full area', () => {
    const mesh = triangulatePolygon({
      outer: [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 40 },
        { x: 0, y: 40 },
      ],
      holes: [],
    });

    expect(mesh.positions).toHaveLength(8);
    expect(mesh.indices).toHaveLength(6);
    expect(meshArea(mesh)).toBeCloseTo(30 * 40, 3);
  });

  it('matches the ring area minus the hole area', () => {
    const [polygon] = evaluateComposition({
      terms: [
        {
          operand: createRectangle({
            center: { x: 15, y: 20 },
            width: 30,
            length: 40,
            rotationDegrees: 0,
          }),
          operation: 'union',
        },
        { operand: createCircle({ center: { x: 12, y: 18 }, radius: 4 }), operation: 'subtract' },
      ],
    });

    expect(polygon.holes).toHaveLength(1);

    const mesh = triangulatePolygon(polygon);

    expect(meshArea(mesh)).toBeCloseTo(polygonArea(polygon), 3);
    expect(Math.abs(meshArea(mesh) - polygonArea(polygon))).toBeLessThan(
      polygonArea(polygon) * AREA_EPSILON + AREA_EPSILON
    );
  });

  it('handles several holes at once', () => {
    const polygon: PolygonWithHoles = {
      outer: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 },
      ],
      holes: [
        [
          { x: 2, y: 2 },
          { x: 2, y: 6 },
          { x: 6, y: 6 },
          { x: 6, y: 2 },
        ],
        [
          { x: 12, y: 12 },
          { x: 12, y: 18 },
          { x: 18, y: 18 },
          { x: 18, y: 12 },
        ],
      ],
    };

    expect(meshArea(triangulatePolygon(polygon))).toBeCloseTo(20 * 20 - 16 - 36, 3);
  });

  it('keeps every index inside the vertex list', () => {
    const [polygon] = evaluateComposition({
      terms: [
        {
          operand: createRectangle({
            center: { x: 5, y: 5 },
            width: 10,
            length: 10,
            rotationDegrees: 25,
          }),
          operation: 'union',
        },
        { operand: createCircle({ center: { x: 5, y: 5 }, radius: 2 }), operation: 'subtract' },
      ],
    });

    const mesh = triangulatePolygon(polygon);
    const vertexCount = mesh.positions.length / 2;

    expect(mesh.indices.length).toBeGreaterThan(0);

    for (const index of mesh.indices) {
      expect(index).toBeLessThan(vertexCount);
    }
  });

  it('returns an empty mesh for a degenerate outer ring', () => {
    const mesh = triangulatePolygon({ outer: [{ x: 0, y: 0 }], holes: [] });

    expect(mesh.positions).toHaveLength(0);
    expect(mesh.indices).toHaveLength(0);
  });

  it('ignores degenerate holes', () => {
    const mesh = triangulatePolygon({
      outer: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      holes: [[{ x: 5, y: 5 }]],
    });

    expect(meshArea(mesh)).toBeCloseTo(100, 3);
  });
});

describe('triangulateMultiPolygon', () => {
  const firstSquare: PolygonWithHoles = {
    outer: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    holes: [],
  };
  const secondSquare: PolygonWithHoles = {
    outer: [
      { x: 20, y: 20 },
      { x: 26, y: 20 },
      { x: 26, y: 26 },
      { x: 20, y: 26 },
    ],
    holes: [],
  };

  it('adds up the area of every polygon', () => {
    expect(meshArea(triangulateMultiPolygon([firstSquare, secondSquare]))).toBeCloseTo(
      10 * 10 + 6 * 6,
      3
    );
  });

  it('shifts the indices of later polygons past the vertices already written', () => {
    const mesh = triangulateMultiPolygon([firstSquare, secondSquare]);
    const vertexCount = mesh.positions.length / 2;

    expect(vertexCount).toBe(8);
    expect(Math.max(...mesh.indices)).toBe(vertexCount - 1);

    for (const index of mesh.indices) {
      expect(index).toBeLessThan(vertexCount);
    }
  });

  it('returns an empty mesh for an empty plot', () => {
    const mesh = triangulateMultiPolygon([]);

    expect(mesh.positions).toHaveLength(0);
    expect(mesh.indices).toHaveLength(0);
  });
});
