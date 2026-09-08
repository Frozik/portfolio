import type { Vector2 } from '@frozik/utils/math/vector2';

import type { EdgeRef, Wall } from '../level';
import { dot, subtract } from '../vector';
import type { CellGrid } from './cell-grid';
import { isBlock, isSolid } from './cell-grid';

/** One metre of wall face with empty space in front of it, located on its wall's edge. */
export interface UnitFace extends EdgeRef {
  /** Metres from the edge's first vertex to the start of this face. */
  readonly at: number;
  /** Unit outward normal of the face. */
  readonly normal: Vector2;
  /** Mid-point of the face on the wall. */
  readonly center: Vector2;
}

const ON_LINE_TOLERANCE = 1e-6;
const UNIT = 1;
const HALF = 0.5;

/**
 * Every one-metre face between a block cell and an empty cell of the board,
 * mapped onto the wall edge that carries it. Chamfered corners shorten
 * edges, which is why the face is located by geometry rather than by index.
 */
export function exposedUnitFaces(grid: CellGrid, walls: readonly Wall[]): readonly UnitFace[] {
  const faces: UnitFace[] = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (!isBlock(grid, x, y)) {
        continue;
      }
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        if (isSolid(grid, x + dx, y + dy)) {
          continue;
        }
        const normal = { x: dx, y: dy };
        const center = { x: x + HALF + dx * HALF, y: y + HALF + dy * HALF };
        const located = locate(walls, center, normal);
        if (located !== undefined) {
          faces.push({ ...located, normal, center });
        }
      }
    }
  }
  return faces;
}

/** The wall edge lying along `center` with the given outward normal, and where the unit face starts on it. */
function locate(
  walls: readonly Wall[],
  center: Vector2,
  normal: Vector2
): (EdgeRef & { readonly at: number }) | undefined {
  for (let wallIndex = 0; wallIndex < walls.length; wallIndex += 1) {
    const edges = walls[wallIndex].edges;
    for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
      const edge = edges[edgeIndex];
      if (!sameDirection(edge.normal, normal)) {
        continue;
      }
      const offset = subtract(center, edge.from);
      if (Math.abs(dot(offset, edge.normal)) > ON_LINE_TOLERANCE) {
        continue;
      }
      const along = dot(offset, edge.direction);
      const start = along - HALF * UNIT;
      if (start >= -ON_LINE_TOLERANCE && start + UNIT <= edge.length + ON_LINE_TOLERANCE) {
        return { wall: wallIndex, edge: edgeIndex, at: Math.max(0, start) };
      }
    }
  }
  return undefined;
}

function sameDirection(a: Vector2, b: Vector2): boolean {
  return Math.abs(a.x - b.x) < ON_LINE_TOLERANCE && Math.abs(a.y - b.y) < ON_LINE_TOLERANCE;
}
