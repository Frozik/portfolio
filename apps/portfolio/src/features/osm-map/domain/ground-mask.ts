import type { MultiPolygon, Ring } from '@frozik/utils/geometry/polygonTypes';
import type { Vector2 } from '@frozik/utils/math/vector2';

import { GROUND_MASK_CELL_M } from './constants';

/** A line that takes ground with it: a road, a path, a stream, as wide as twice `halfWidthM`. */
export interface ClearanceLine {
  readonly points: readonly Vector2[];
  readonly halfWidthM: number;
}

/** Ground nothing may grow on, in plan metres from the tile's north-west corner (x east, y north). */
export interface GroundObstacles {
  readonly areas: MultiPolygon;
  readonly lines: readonly ClearanceLine[];
}

/** The tile square as a grid of cells, row 0 along the north edge; a set cell is taken ground. */
export interface GroundMask {
  readonly cellM: number;
  readonly cellsPerSide: number;
  readonly taken: Uint8Array;
}

const TAKEN = 1;
const CELL_CENTRE = 0.5;

function columnOf(xM: number, mask: GroundMask): number {
  return Math.floor(xM / mask.cellM);
}

function rowOf(yM: number, mask: GroundMask): number {
  return Math.floor(-yM / mask.cellM);
}

/**
 * Scanline fill, even-odd over the outer ring and its holes together: every
 * edge leaves its crossing with each row centre it spans, and a row is filled
 * between consecutive crossings.
 */
function fillPolygon(rings: readonly Ring[], mask: GroundMask): void {
  const { cellM, cellsPerSide, taken } = mask;
  const crossings = new Map<number, number[]>();
  for (const ring of rings) {
    ring.forEach((from, index) => {
      const to = ring[(index + 1) % ring.length];
      const fromRow = -from.y / cellM;
      const toRow = -to.y / cellM;
      if (fromRow === toRow) {
        return;
      }
      const firstRow = Math.max(0, Math.ceil(Math.min(fromRow, toRow) - CELL_CENTRE));
      const lastRow = Math.min(
        cellsPerSide - 1,
        Math.ceil(Math.max(fromRow, toRow) - CELL_CENTRE) - 1
      );
      for (let row = firstRow; row <= lastRow; row++) {
        const along = (row + CELL_CENTRE - fromRow) / (toRow - fromRow);
        const column = (from.x + (to.x - from.x) * along) / cellM;
        const rowCrossings = crossings.get(row) ?? [];
        rowCrossings.push(column);
        crossings.set(row, rowCrossings);
      }
    });
  }
  for (const [row, rowCrossings] of crossings) {
    rowCrossings.sort((left, right) => left - right);
    for (let pair = 0; pair + 1 < rowCrossings.length; pair += 2) {
      const firstColumn = Math.max(0, Math.ceil(rowCrossings[pair] - CELL_CENTRE));
      const lastColumn = Math.min(
        cellsPerSide - 1,
        Math.ceil(rowCrossings[pair + 1] - CELL_CENTRE) - 1
      );
      if (lastColumn >= firstColumn) {
        taken.fill(TAKEN, row * cellsPerSide + firstColumn, row * cellsPerSide + lastColumn + 1);
      }
    }
  }
}

function distanceToSegmentSquared(point: Vector2, from: Vector2, to: Vector2): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const along =
    lengthSquared === 0
      ? 0
      : Math.min(
          1,
          Math.max(0, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared)
        );
  const offsetX = point.x - (from.x + dx * along);
  const offsetY = point.y - (from.y + dy * along);
  return offsetX * offsetX + offsetY * offsetY;
}

/** Every cell whose centre lies within the half width of the segment: a capsule stamped on the grid. */
function strokeSegment(from: Vector2, to: Vector2, halfWidthM: number, mask: GroundMask): void {
  const { cellM, cellsPerSide, taken } = mask;
  const halfWidthSquared = halfWidthM * halfWidthM;
  const firstColumn = Math.max(0, columnOf(Math.min(from.x, to.x) - halfWidthM, mask));
  const lastColumn = Math.min(
    cellsPerSide - 1,
    columnOf(Math.max(from.x, to.x) + halfWidthM, mask)
  );
  const firstRow = Math.max(0, rowOf(Math.max(from.y, to.y) + halfWidthM, mask));
  const lastRow = Math.min(cellsPerSide - 1, rowOf(Math.min(from.y, to.y) - halfWidthM, mask));
  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      const centre = { x: (column + CELL_CENTRE) * cellM, y: -(row + CELL_CENTRE) * cellM };
      if (distanceToSegmentSquared(centre, from, to) <= halfWidthSquared) {
        taken[row * cellsPerSide + column] = TAKEN;
      }
    }
  }
}

/** Rasterises a tile's obstacles; anything beyond the tile square is cut off. */
export function groundMaskOf(tileSizeM: number, { areas, lines }: GroundObstacles): GroundMask {
  const cellsPerSide = Math.ceil(tileSizeM / GROUND_MASK_CELL_M);
  const mask: GroundMask = {
    cellM: GROUND_MASK_CELL_M,
    cellsPerSide,
    taken: new Uint8Array(cellsPerSide * cellsPerSide),
  };
  for (const polygon of areas) {
    fillPolygon([polygon.outer, ...polygon.holes], mask);
  }
  for (const { points, halfWidthM } of lines) {
    for (let index = 1; index < points.length; index++) {
      strokeSegment(points[index - 1], points[index], halfWidthM, mask);
    }
  }
  return mask;
}

function isTakenAt(xM: number, yM: number, mask: GroundMask): boolean {
  const column = columnOf(xM, mask);
  const row = rowOf(yM, mask);
  return (
    column >= 0 &&
    row >= 0 &&
    column < mask.cellsPerSide &&
    row < mask.cellsPerSide &&
    mask.taken[row * mask.cellsPerSide + column] === TAKEN
  );
}

/** Whether a disc is free at its centre and at the four compass points of its rim. */
export function isGroundFree(centre: Vector2, radiusM: number, mask: GroundMask): boolean {
  return [
    [0, 0],
    [radiusM, 0],
    [-radiusM, 0],
    [0, radiusM],
    [0, -radiusM],
  ].every(([dx, dy]) => !isTakenAt(centre.x + dx, centre.y + dy, mask));
}
