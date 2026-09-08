import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Edge, FaceKind, Wall } from './level';
import { distance, normalize, rightNormal, subtract } from './vector';

/** How far an edge may stray from exactly horizontal, vertical or diagonal. */
const ORIENTATION_TOLERANCE = 1e-6;
const MIN_VERTICES = 3;

/** Whether an edge is axis-aligned, diagonal, or neither. */
function orientationOf(direction: Vector2): 'axis' | 'diagonal' | undefined {
  const dx = Math.abs(direction.x);
  const dy = Math.abs(direction.y);
  if (dx < ORIENTATION_TOLERANCE || dy < ORIENTATION_TOLERANCE) {
    return 'axis';
  }
  if (Math.abs(dx - dy) < ORIENTATION_TOLERANCE) {
    return 'diagonal';
  }
  return undefined;
}

/** Twice the signed area: positive for counter-clockwise vertices in a y-up frame. */
function signedDoubleArea(vertices: readonly Vector2[]): number {
  return vertices.reduce((sum, vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return sum + vertex.x * next.y - next.x * vertex.y;
  }, 0);
}

/**
 * Builds a wall from counter-clockwise vertices. The face kind is derived from
 * each edge's orientation — an axis-aligned edge is a floor, a diagonal one a
 * deflector — so a diagonal can never be a floor by mistake; `bounceEdges`
 * upgrades axis-aligned edges to the stronger rebound, and `cupEdges` are the
 * segments of a hole's rim, the one place an edge may have any orientation.
 */
export function createWall(
  vertices: readonly Vector2[],
  bounceEdges: ReadonlySet<number> = new Set(),
  cupEdges: ReadonlySet<number> = new Set()
): Wall {
  if (vertices.length < MIN_VERTICES) {
    throw new Error(`createWall: a wall needs at least ${MIN_VERTICES} vertices`);
  }
  if (signedDoubleArea(vertices) <= 0) {
    throw new Error('createWall: vertices must run counter-clockwise');
  }
  const edges: Edge[] = vertices.map((from, index) => {
    const to = vertices[(index + 1) % vertices.length];
    const direction = normalize(subtract(to, from));
    const orientation = orientationOf(direction);
    if (orientation === undefined && !cupEdges.has(index)) {
      throw new Error(`createWall: edge ${index} is neither axis-aligned nor diagonal`);
    }
    const kind: FaceKind = cupEdges.has(index)
      ? 'cup'
      : orientation === 'diagonal'
        ? 'deflector'
        : bounceEdges.has(index)
          ? 'bounce'
          : 'floor';
    return {
      from,
      to,
      direction,
      normal: rightNormal(direction),
      length: distance(from, to),
      kind,
    };
  });
  const bounds = {
    min: { x: Math.min(...vertices.map(v => v.x)), y: Math.min(...vertices.map(v => v.y)) },
    max: { x: Math.max(...vertices.map(v => v.x)), y: Math.max(...vertices.map(v => v.y)) },
  };
  return { vertices, edges, bounds };
}

/** A triangular wall from any three points; the vertices are ordered counter-clockwise. */
export function createTriangle(a: Vector2, b: Vector2, c: Vector2): Wall {
  return signedDoubleArea([a, b, c]) > 0 ? createWall([a, b, c]) : createWall([a, c, b]);
}

/** An axis-aligned block from its lower-left corner and size. */
export function createBlock(x: number, y: number, width: number, height: number): Wall {
  return createWall([
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]);
}

export type Corner = 'lowerLeft' | 'lowerRight' | 'upperRight' | 'upperLeft';

/**
 * A block with some corners cut at 45° by `chamfer` metres — the reference's
 * look, and the deflectors that make corridor bends shootable.
 */
export function createChamferedBlock(
  x: number,
  y: number,
  width: number,
  height: number,
  chamfer: number,
  corners: ReadonlySet<Corner>
): Wall {
  const right = x + width;
  const top = y + height;
  const vertices: Vector2[] = [];
  const push = (point: Vector2): void => {
    vertices.push(point);
  };
  if (corners.has('lowerLeft')) {
    push({ x: x + chamfer, y });
  } else {
    push({ x, y });
  }
  if (corners.has('lowerRight')) {
    push({ x: right - chamfer, y });
    push({ x: right, y: y + chamfer });
  } else {
    push({ x: right, y });
  }
  if (corners.has('upperRight')) {
    push({ x: right, y: top - chamfer });
    push({ x: right - chamfer, y: top });
  } else {
    push({ x: right, y: top });
  }
  if (corners.has('upperLeft')) {
    push({ x: x + chamfer, y: top });
    push({ x, y: top - chamfer });
  } else {
    push({ x, y: top });
  }
  if (corners.has('lowerLeft')) {
    push({ x, y: y + chamfer });
  }
  return createWall(vertices);
}

/** Whether a point lies inside the wall — ray casting, so a wall with a notch is handled too. */
export function containsPoint(wall: Wall, point: Vector2): boolean {
  let inside = false;
  for (const edge of wall.edges) {
    const { from, to } = edge;
    const crosses = from.y > point.y !== to.y > point.y;
    if (crosses && point.x < ((to.x - from.x) * (point.y - from.y)) / (to.y - from.y) + from.x) {
      inside = !inside;
    }
  }
  return inside;
}
