import { extrudePrism } from '@frozik/utils/geometry/extrudeFootprint';
import type { LitMesh } from '@frozik/utils/geometry/litMesh';
import { EMPTY_LIT_MESH, mergeLitMeshes } from '@frozik/utils/geometry/litMesh';
import type { PolygonWithHoles } from '@frozik/utils/geometry/polygonTypes';

export type CarBody = 'sedan' | 'hatchback' | 'crossover' | 'van' | 'bus';

export const CAR_BODIES: readonly CarBody[] = ['sedan', 'hatchback', 'crossover', 'van', 'bus'];

/** A slab of the car: a box, metres, centred across the car and placed along it. */
interface Slab {
  /** Where the slab starts and ends along the car, from the rear (0) toward the front. */
  readonly fromM: number;
  readonly toM: number;
  readonly widthM: number;
  readonly baseM: number;
  readonly topM: number;
}

interface BodyShape {
  readonly lengthM: number;
  readonly slabs: readonly Slab[];
}

/** Body plus cabin, the two boxes every car on a map is made of; a bus is one tall box. */
const SHAPES: Readonly<Record<CarBody, BodyShape>> = {
  sedan: {
    lengthM: 4.5,
    slabs: [
      { fromM: 0, toM: 4.5, widthM: 1.8, baseM: 0.25, topM: 0.85 },
      { fromM: 1.2, toM: 3.3, widthM: 1.65, baseM: 0.85, topM: 1.45 },
    ],
  },
  hatchback: {
    lengthM: 4,
    slabs: [
      { fromM: 0, toM: 4, widthM: 1.75, baseM: 0.25, topM: 0.85 },
      { fromM: 0.3, toM: 2.7, widthM: 1.6, baseM: 0.85, topM: 1.5 },
    ],
  },
  crossover: {
    lengthM: 4.6,
    slabs: [
      { fromM: 0, toM: 4.6, widthM: 1.9, baseM: 0.3, topM: 1.05 },
      { fromM: 0.4, toM: 3.4, widthM: 1.75, baseM: 1.05, topM: 1.7 },
    ],
  },
  van: {
    lengthM: 5,
    slabs: [
      { fromM: 0, toM: 5, widthM: 2, baseM: 0.3, topM: 1 },
      { fromM: 0.2, toM: 4.2, widthM: 1.95, baseM: 1, topM: 2.3 },
    ],
  },
  bus: {
    lengthM: 12,
    slabs: [{ fromM: 0, toM: 12, widthM: 2.5, baseM: 0.35, topM: 3.2 }],
  },
};

/** Fleet colours, roughly in the proportions seen on a real street. */
export const CAR_COLORS: readonly (readonly [number, number, number])[] = [
  [0.92, 0.92, 0.92],
  [0.75, 0.76, 0.78],
  [0.15, 0.15, 0.16],
  [0.4, 0.41, 0.43],
  [0.72, 0.12, 0.12],
  [0.14, 0.22, 0.48],
  [0.16, 0.36, 0.24],
  [0.78, 0.7, 0.55],
  [0.95, 0.76, 0.1],
  [0.9, 0.45, 0.1],
];

/** The car's plan, x along the car with the nose at +x and the tail at −x, y across it. */
function slabPolygon(slab: Slab, lengthM: number): PolygonWithHoles {
  const rear = slab.fromM - lengthM / 2;
  const front = slab.toM - lengthM / 2;
  const half = slab.widthM / 2;
  return {
    outer: [
      { x: rear, y: -half },
      { x: front, y: -half },
      { x: front, y: half },
      { x: rear, y: half },
    ],
    holes: [],
  };
}

/** The body as a mesh in metres, centred on the ground under the car, nose toward +x, y up, z south. */
export function carBodyMesh(body: CarBody): LitMesh {
  const shape = SHAPES[body];
  const meshes = shape.slabs.map(slab =>
    extrudePrism({
      polygons: [slabPolygon(slab, shape.lengthM)],
      baseElevation: slab.baseM,
      topElevation: slab.topM,
    })
  );
  return mergeLitMeshes(meshes) ?? EMPTY_LIT_MESH;
}

export function carLengthM(body: CarBody): number {
  return SHAPES[body].lengthM;
}
