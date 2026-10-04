import type { MultiPolygon } from '@frozik/utils/geometry/polygonTypes';

import { FOREST_AREA_PER_TREE_M2, MAX_TREES_PER_TILE, STREET_MESH_UNIT_M } from './constants';
import { groundMaskOf } from './ground-mask';
import type { TreeBatch } from './tree-cover';
import { INT16_PER_TREE, plantTrees } from './tree-cover';

const TILE_SIZE_M = 3000;
const OPEN_GROUND = groundMaskOf(TILE_SIZE_M, { areas: [], lines: [] });

/** A square counter-clockwise in plan (y north), its north-west corner `westM` east and `northM` south of the tile corner. */
function square(sideM: number, westM: number = 0, northM: number = 0): MultiPolygon {
  return [
    {
      outer: [
        { x: westM, y: -northM },
        { x: westM, y: -northM - sideM },
        { x: westM + sideM, y: -northM - sideM },
        { x: westM + sideM, y: -northM },
      ],
      holes: [],
    },
  ];
}

/** Every trunk in plan metres, x east and y north. */
function trunksOf(batches: readonly TreeBatch[]): readonly { x: number; y: number }[] {
  return batches.flatMap(batch =>
    Array.from({ length: batch.instances.length / INT16_PER_TREE }, (_, tree) => ({
      x: batch.instances[tree * INT16_PER_TREE] * STREET_MESH_UNIT_M,
      y: -batch.instances[tree * INT16_PER_TREE + 1] * STREET_MESH_UNIT_M,
    }))
  );
}

function treeCount(batches: ReturnType<typeof plantTrees>): number {
  return batches.reduce((sum, batch) => sum + batch.instances.length / INT16_PER_TREE, 0);
}

describe('tree cover', () => {
  it('plants a wood in proportion to its area, every tree inside it, the same wood every time', () => {
    const sideM = 500;
    const covers = [{ kind: 'forest' as const, polygons: square(sideM) }];

    const batches = plantTrees(covers, OPEN_GROUND, 'tile');
    const again = plantTrees(covers, OPEN_GROUND, 'tile');
    const expected = (sideM * sideM) / FOREST_AREA_PER_TREE_M2;

    expect(treeCount(batches)).toBeGreaterThan(expected * 0.9);
    expect(treeCount(batches)).toBeLessThan(expected * 1.1);
    expect(batches.map(batch => batch.species)).toEqual(['spruce', 'deciduous']);
    for (const batch of batches) {
      for (let offset = 0; offset < batch.instances.length; offset += INT16_PER_TREE) {
        const [x, south, crown, height] = batch.instances.subarray(offset, offset + INT16_PER_TREE);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(sideM / STREET_MESH_UNIT_M);
        expect(south).toBeGreaterThanOrEqual(0);
        expect(south).toBeLessThanOrEqual(sideM / STREET_MESH_UNIT_M);
        expect(crown).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(crown);
      }
    }
    expect(again.map(batch => [...batch.instances])).toEqual(
      batches.map(batch => [...batch.instances])
    );
  });

  it('thins a tile that would grow more trees than the ceiling', () => {
    const batches = plantTrees([{ kind: 'forest', polygons: square(3000) }], OPEN_GROUND, 'dense');

    expect(treeCount(batches)).toBeLessThanOrEqual(MAX_TREES_PER_TILE + 1);
    expect(treeCount(batches)).toBeGreaterThan(MAX_TREES_PER_TILE * 0.95);
  });

  it('grows fewer, mostly broadleaf trees in a park than in a wood of the same size', () => {
    const wood = plantTrees([{ kind: 'forest', polygons: square(400) }], OPEN_GROUND, 'seed');
    const park = plantTrees([{ kind: 'park', polygons: square(400) }], OPEN_GROUND, 'seed');
    const broadleaves = (batches: typeof park): number =>
      batches.find(batch => batch.species === 'deciduous')?.instances.length ?? 0;

    expect(treeCount(park)).toBeLessThan(treeCount(wood) / 2);
    expect(broadleaves(park) / (treeCount(park) * INT16_PER_TREE)).toBeGreaterThan(0.5);
  });

  it('plants nothing on a tile without cover', () => {
    expect(plantTrees([], OPEN_GROUND, 'bare')).toEqual([]);
  });

  it('keeps the trees of a park off the moat its polygon encloses, the lawn around as dense as before', () => {
    const park = [{ kind: 'park' as const, polygons: square(1000) }];
    const moat = groundMaskOf(TILE_SIZE_M, { areas: square(400, 300, 300), lines: [] });

    const open = trunksOf(plantTrees(park, OPEN_GROUND, 'castle'));
    const trunks = trunksOf(plantTrees(park, moat, 'castle'));
    const onMoat = ({ x, y }: { x: number; y: number }): boolean =>
      x > 300 && x < 700 && y < -300 && y > -700;

    expect(open.some(onMoat)).toBe(true);
    expect(trunks.some(onMoat)).toBe(false);
    expect(trunks.length).toBeGreaterThan(open.filter(trunk => !onMoat(trunk)).length * 0.9);
  });

  it('leaves a road through a wood clear', () => {
    const wood = [{ kind: 'forest' as const, polygons: square(400) }];
    const road = groundMaskOf(TILE_SIZE_M, {
      areas: [],
      lines: [
        {
          points: [
            { x: 0, y: -200 },
            { x: 400, y: -200 },
          ],
          halfWidthM: 6,
        },
      ],
    });

    const trunks = trunksOf(plantTrees(wood, road, 'road'));

    expect(trunks.length).toBeGreaterThan(0);
    expect(trunks.every(({ y }) => Math.abs(y + 200) > 6)).toBe(true);
  });
});
