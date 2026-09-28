import type { MultiPolygon } from '@frozik/utils/geometry/polygonTypes';

import { FOREST_AREA_PER_TREE_M2, MAX_TREES_PER_TILE, STREET_MESH_UNIT_M } from './constants';
import { INT16_PER_TREE, plantTrees } from './tree-cover';

/** A square wood, counter-clockwise in plan (y north), metres from the tile corner. */
function square(sideM: number): MultiPolygon {
  return [
    {
      outer: [
        { x: 0, y: 0 },
        { x: sideM, y: 0 },
        { x: sideM, y: -sideM },
        { x: 0, y: -sideM },
      ].toReversed(),
      holes: [],
    },
  ];
}

function treeCount(batches: ReturnType<typeof plantTrees>): number {
  return batches.reduce((sum, batch) => sum + batch.instances.length / INT16_PER_TREE, 0);
}

describe('tree cover', () => {
  it('plants a wood in proportion to its area, every tree inside it, the same wood every time', () => {
    const sideM = 500;
    const covers = [{ kind: 'forest' as const, polygons: square(sideM) }];

    const batches = plantTrees(covers, 'tile');
    const again = plantTrees(covers, 'tile');
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
    const batches = plantTrees([{ kind: 'forest', polygons: square(3000) }], 'dense');

    expect(treeCount(batches)).toBeLessThanOrEqual(MAX_TREES_PER_TILE + 1);
    expect(treeCount(batches)).toBeGreaterThan(MAX_TREES_PER_TILE * 0.95);
  });

  it('grows fewer, mostly broadleaf trees in a park than in a wood of the same size', () => {
    const wood = plantTrees([{ kind: 'forest', polygons: square(400) }], 'seed');
    const park = plantTrees([{ kind: 'park', polygons: square(400) }], 'seed');
    const broadleaves = (batches: typeof park): number =>
      batches.find(batch => batch.species === 'deciduous')?.instances.length ?? 0;

    expect(treeCount(park)).toBeLessThan(treeCount(wood) / 2);
    expect(broadleaves(park) / (treeCount(park) * INT16_PER_TREE)).toBeGreaterThan(0.5);
  });

  it('plants nothing on a tile without cover', () => {
    expect(plantTrees([], 'bare')).toEqual([]);
  });
});
