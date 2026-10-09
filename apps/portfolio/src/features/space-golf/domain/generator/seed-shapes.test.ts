import { describe, expect, it } from 'vitest';

import { gridOfCells, hasDiagonalOnlyContact, isConnected } from './cell-grid';
import { createRandom } from './random';
import type { Footprint } from './seed-shapes';
import { MAX_THICKNESS_CELLS, seedFootprint } from './seed-shapes';

const DRAWS = 400;
const KINDS = ['islet', 'body', 'giant'] as const;

function draws(): readonly Footprint[] {
  const random = createRandom('seed-shapes');
  return KINDS.flatMap(kind => Array.from({ length: DRAWS }, () => seedFootprint(random, kind)));
}

function isOneRunPerLine(footprint: Footprint, line: 'x' | 'y'): boolean {
  const along = line === 'y' ? 'x' : 'y';
  const lines = Map.groupBy(footprint.cells, cell => cell[line]);
  return [...lines.values()].every(cells => {
    const positions = cells.map(cell => cell[along]);
    return Math.max(...positions) - Math.min(...positions) + 1 === positions.length;
  });
}

describe('seedFootprint', () => {
  it('starts every island as one solid piece filling its box edge to edge, with no row or column crossing it twice', () => {
    for (const footprint of draws()) {
      const xs = footprint.cells.map(cell => cell.x);
      const ys = footprint.cells.map(cell => cell.y);

      expect([Math.min(...xs), Math.max(...xs) + 1]).toEqual([0, footprint.width]);
      expect([Math.min(...ys), Math.max(...ys) + 1]).toEqual([0, footprint.height]);
      expect(isOneRunPerLine(footprint, 'x')).toBe(true);
      expect(isOneRunPerLine(footprint, 'y')).toBe(true);
    }
  });

  it('never has two cells touching only at a corner', () => {
    for (const footprint of draws()) {
      const padded = gridOfCells(
        footprint.width + 2,
        footprint.height + 2,
        footprint.cells.map(cell => ({ x: cell.x + 1, y: cell.y + 1 }))
      );
      const whole = { x: 0, y: 0, width: footprint.width + 2, height: footprint.height + 2 };

      expect(hasDiagonalOnlyContact(padded, whole)).toBe(false);
      expect(isConnected(padded, { x: 0, y: 0 })).toBe(true);
    }
  });

  it('is never thicker than an island may be: no square a cell wider than that is solid all through', () => {
    const side = MAX_THICKNESS_CELLS + 1;
    for (const footprint of draws()) {
      const solid = new Set(footprint.cells.map(cell => `${cell.x},${cell.y}`));
      for (const corner of footprint.cells) {
        const square = Array.from({ length: side * side }, (_, index) => ({
          x: corner.x + (index % side),
          y: corner.y + Math.floor(index / side),
        }));

        expect(square.every(cell => solid.has(`${cell.x},${cell.y}`))).toBe(false);
      }
    }
  });

  it('starts some bodies and giants from a staircase or a cross, not only from bars and blocks', () => {
    const notRectangles = draws().filter(
      footprint => footprint.cells.length < footprint.width * footprint.height
    );

    expect(notRectangles.length).toBeGreaterThan(DRAWS / 2);
  });
});
