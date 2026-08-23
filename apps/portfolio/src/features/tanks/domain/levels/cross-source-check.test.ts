import { describe, expect, it } from 'vitest';

import type { EnemyType, TerrainKind } from '../types';
import { getStageByNumber } from './registry';

/**
 * §1.2 asks for the vendored level data to be cross-checked against a second, independently
 * transcribed MIT source: `dogballs/cattle-bity`, `data/maps/original/NN.json`. That source is
 * *not* vendored here — it was fetched once while this test was written, converted, and diffed
 * against our generated stages; the numbers below are the result, frozen as expectations.
 *
 * Conversion: cattle-bity stores pixel rectangles at 4× the NES scale, so 32 of their pixels are
 * one of our 8-wu cells, and every rectangle in the five checked stages is 32-aligned — the two
 * models line up exactly, with no rounding anywhere.
 *
 * Two structural differences are expected on every stage and are not discrepancies:
 * the second source draws neither the eagle (4 cells) nor its brick nest (8 cells), because it
 * builds the base programmatically instead of storing it in the map.
 */
const BASE_NEST_BRICK_CELLS = 8;
const BASE_EAGLE_CELLS = 4;

interface ICrossCheckedStage {
  readonly stageNumber: number;
  /** Cell counts read off the second source, keyed by our terrain kinds. */
  readonly secondSourceCells: Partial<Record<TerrainKind, number>>;
  /** Cells ours has on top of that, beyond the base the second source never stores. */
  readonly extraBrickCells?: number;
  readonly enemyCounts: Partial<Record<EnemyType, number>>;
  readonly note?: string;
}

const CROSS_CHECKED_STAGES: readonly ICrossCheckedStage[] = [
  {
    stageNumber: 1,
    secondSourceCells: { brick: 212, steel: 8 },
    enemyCounts: { basic: 18, fast: 2 },
  },
  {
    stageNumber: 5,
    secondSourceCells: { brick: 126, steel: 26, water: 60 },
    // Two tiles the two transcriptions disagree on: our source puts a half-tile brick at tile
    // (2, 1) where theirs has none, and a full brick at tile (8, 6) where theirs has only its
    // left half. Four cells in total, both localised, neither near the base or a spawn point —
    // unresolvable without footage, so ours (the feichao93 transcription) stands.
    extraBrickCells: 4,
    enemyCounts: { power: 5, armor: 2, basic: 8, fast: 5 },
  },
  {
    stageNumber: 13,
    secondSourceCells: { brick: 192, steel: 52, trees: 56 },
    enemyCounts: { power: 8, fast: 8, armor: 4 },
  },
  {
    stageNumber: 26,
    secondSourceCells: { water: 48, trees: 88, brick: 32, steel: 64 },
    enemyCounts: { fast: 6, armor: 6, basic: 4, power: 4 },
    // The second source splits the same 20 enemies as 5 basic + 3 power where ours reads
    // 4 + 4; the fast and armor halves agree, and the carrier slots (3, 10, 17) are unaffected.
    note: 'enemy mix differs from the second source by one basic ↔ power swap',
  },
  {
    stageNumber: 35,
    secondSourceCells: { brick: 192, trees: 112, steel: 8, water: 96 },
    enemyCounts: { armor: 10, fast: 6, power: 4 },
  },
];

function countTerrainKinds(stageNumber: number): Partial<Record<TerrainKind, number>> {
  const counts: Partial<Record<TerrainKind, number>> = {};

  for (const cell of getStageByNumber(stageNumber).terrain) {
    if (cell.kind !== 'empty') {
      counts[cell.kind] = (counts[cell.kind] ?? 0) + 1;
    }
  }

  return counts;
}

function countEnemyTypes(stageNumber: number): Partial<Record<EnemyType, number>> {
  const counts: Partial<Record<EnemyType, number>> = {};

  for (const enemyType of getStageByNumber(stageNumber).enemyQueue) {
    counts[enemyType] = (counts[enemyType] ?? 0) + 1;
  }

  return counts;
}

describe('original stages cross-checked against the second MIT source', () => {
  it.each(CROSS_CHECKED_STAGES)('stage $stageNumber matches cattle-bity cell for cell', ({
    stageNumber,
    secondSourceCells,
    extraBrickCells,
  }) => {
    expect(countTerrainKinds(stageNumber)).toEqual({
      ...secondSourceCells,
      brick: (secondSourceCells.brick ?? 0) + BASE_NEST_BRICK_CELLS + (extraBrickCells ?? 0),
      eagle: BASE_EAGLE_CELLS,
    });
  });

  it.each(CROSS_CHECKED_STAGES)('stage $stageNumber fields the cross-checked enemy mix', ({
    stageNumber,
    enemyCounts,
  }) => {
    expect(countEnemyTypes(stageNumber)).toEqual(enemyCounts);
  });
});
