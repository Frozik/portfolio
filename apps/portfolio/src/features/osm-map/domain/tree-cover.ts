import type { MultiPolygon } from '@frozik/utils/geometry/polygonTypes';
import type { TreeTemplateSpecies } from '@frozik/utils/geometry/treeTemplate';
import { triangulateMultiPolygon } from '@frozik/utils/geometry/triangulatePolygon';
import alea from 'alea';

import {
  FOREST_AREA_PER_TREE_M2,
  MAX_TREES_PER_TILE,
  PARK_AREA_PER_TREE_M2,
  STREET_MESH_UNIT_M,
} from './constants';

/** The two silhouettes a map tells apart: a conifer and a broadleaf. */
export type MapTreeSpecies = Extract<TreeTemplateSpecies, 'spruce' | 'deciduous'>;
export const MAP_TREE_SPECIES: readonly MapTreeSpecies[] = ['spruce', 'deciduous'];

export type TreeCoverKind = 'forest' | 'park';

/** Ground that grows trees, in plan metres from the tile's north-west corner. */
export interface TreeCover {
  readonly kind: TreeCoverKind;
  readonly polygons: MultiPolygon;
}

/**
 * The trees of one species in a tile, four `int16` each in
 * `STREET_MESH_UNIT_M`: x east and z south of the trunk from the tile's
 * north-west corner, then the crown radius and the height the template is
 * stretched by.
 */
export interface TreeBatch {
  readonly species: MapTreeSpecies;
  readonly instances: Int16Array;
}

export const INT16_PER_TREE = 4;

interface Range {
  readonly min: number;
  readonly max: number;
}

interface Stand {
  readonly areaPerTreeM2: number;
  readonly spruceShare: number;
  readonly heightM: Range;
  readonly crownRadiusM: Range;
}

/** Woods are mostly conifers and grow tall; a park is broadleaves spread wide over lawns. */
const STANDS: Readonly<Record<TreeCoverKind, Stand>> = {
  forest: {
    areaPerTreeM2: FOREST_AREA_PER_TREE_M2,
    spruceShare: 0.7,
    heightM: { min: 8, max: 16 },
    crownRadiusM: { min: 2, max: 3.5 },
  },
  park: {
    areaPerTreeM2: PARK_AREA_PER_TREE_M2,
    spruceShare: 0.25,
    heightM: { min: 6, max: 12 },
    crownRadiusM: { min: 2.5, max: 4 },
  },
};

const COORDINATES_PER_VERTEX = 2;
const VERTICES_PER_TRIANGLE = 3;

interface Triangle {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  readonly cx: number;
  readonly cy: number;
  readonly areaM2: number;
  readonly kind: TreeCoverKind;
}

function trianglesOf(cover: TreeCover): readonly Triangle[] {
  const { positions, indices } = triangulateMultiPolygon(cover.polygons);
  const triangles: Triangle[] = [];
  for (let offset = 0; offset < indices.length; offset += VERTICES_PER_TRIANGLE) {
    const [a, b, c] = [indices[offset], indices[offset + 1], indices[offset + 2]].map(
      index => index * COORDINATES_PER_VERTEX
    );
    const [ax, ay, bx, by, cx, cy] = [
      positions[a],
      positions[a + 1],
      positions[b],
      positions[b + 1],
      positions[c],
      positions[c + 1],
    ];
    const areaM2 = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
    if (areaM2 > 0) {
      triangles.push({ ax, ay, bx, by, cx, cy, areaM2, kind: cover.kind });
    }
  }
  return triangles;
}

function between({ min, max }: Range, roll: number): number {
  return min + (max - min) * roll;
}

function quantized(metres: number): number {
  return Math.round(metres / STREET_MESH_UNIT_M);
}

/**
 * Plants every cover of a tile: a triangle gets trees in proportion to its
 * area, each dropped uniformly inside it, the whole tile thinned when it
 * would exceed `MAX_TREES_PER_TILE`. Seeded, so a tile grows the same woods
 * every time it is decoded.
 */
export function plantTrees(covers: readonly TreeCover[], seed: string): readonly TreeBatch[] {
  const triangles = covers.flatMap(trianglesOf);
  const expectedCount = triangles.reduce(
    (sum, triangle) => sum + triangle.areaM2 / STANDS[triangle.kind].areaPerTreeM2,
    0
  );
  const thinning = Math.min(1, MAX_TREES_PER_TILE / expectedCount);
  const random = alea(seed);
  const planted: Record<MapTreeSpecies, number[]> = { spruce: [], deciduous: [] };
  for (const triangle of triangles) {
    const stand = STANDS[triangle.kind];
    const count = Math.floor((triangle.areaM2 / stand.areaPerTreeM2) * thinning + random());
    for (let tree = 0; tree < count; tree++) {
      const rootU = Math.sqrt(random());
      const v = random();
      const x = (1 - rootU) * triangle.ax + rootU * (1 - v) * triangle.bx + rootU * v * triangle.cx;
      const y = (1 - rootU) * triangle.ay + rootU * (1 - v) * triangle.by + rootU * v * triangle.cy;
      const species: MapTreeSpecies = random() < stand.spruceShare ? 'spruce' : 'deciduous';
      planted[species].push(
        quantized(x),
        quantized(-y),
        quantized(between(stand.crownRadiusM, random())),
        quantized(between(stand.heightM, random()))
      );
    }
  }
  return MAP_TREE_SPECIES.flatMap(species =>
    planted[species].length === 0 ? [] : [{ species, instances: Int16Array.from(planted[species]) }]
  );
}
