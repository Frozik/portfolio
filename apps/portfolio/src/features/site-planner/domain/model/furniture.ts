import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';

import type { RotatedBox } from '../geometry/hit-test-shape';
import type { Meters } from '../units';
import type { UtilitySystem } from './foundation';

export type FurnitureId = Opaque<'FurnitureId', string>;

export function createFurnitureId(): FurnitureId {
  return crypto.randomUUID() as FurnitureId;
}

/**
 * Everything the furniture catalogue offers (`building-editor.md` §6):
 * household pieces and the plumbing fixtures — the fixtures carry the system
 * an indoor route will one day terminate at.
 */
export type FurnitureCatalogId =
  | 'bed-double'
  | 'bed-160'
  | 'bed-single'
  | 'sofa'
  | 'armchair'
  | 'armchair-wing'
  | 'office-chair'
  | 'table'
  | 'table-round'
  | 'coffee-table'
  | 'desk'
  | 'chair'
  | 'wardrobe'
  | 'wardrobe-tall'
  | 'wardrobe-sliding'
  | 'dresser'
  | 'dresser-wide'
  | 'dresser-tall'
  | 'nightstand'
  | 'nightstand-tall'
  | 'tv-stand'
  | 'bookshelf'
  | 'shelving-cube'
  | 'kitchen-run'
  | 'fridge'
  | 'stove'
  | 'sink'
  | 'toilet'
  | 'shower'
  | 'bathtub'
  | 'washing-machine'
  | 'boiler'
  | 'radiator';

export type FurnitureCategory = 'furniture' | 'plumbing';

/**
 * One catalogue row, in real built dimensions: width runs across the piece
 * (local x), depth from its back to its front (local y — the BACK faces −y,
 * which is the side the wall magnet puts against the wall), height up.
 */
export interface FurnitureCatalogEntry {
  readonly id: FurnitureCatalogId;
  readonly category: FurnitureCategory;
  readonly widthMeters: Meters;
  readonly depthMeters: Meters;
  readonly heightMeters: Meters;
  /** The system a fixture belongs to — what its future route will carry. */
  readonly utilityKind?: UtilitySystem;
}

/** The catalogue, in the order the panel lays it out, category by category. */
export const FURNITURE_CATALOG: readonly FurnitureCatalogEntry[] = [
  {
    id: 'bed-double',
    category: 'furniture',
    widthMeters: 1.8,
    depthMeters: 2.1,
    heightMeters: 0.5,
  },
  { id: 'bed-160', category: 'furniture', widthMeters: 1.6, depthMeters: 2.1, heightMeters: 0.5 },
  {
    id: 'bed-single',
    category: 'furniture',
    widthMeters: 0.9,
    depthMeters: 2.1,
    heightMeters: 0.5,
  },
  { id: 'sofa', category: 'furniture', widthMeters: 2.2, depthMeters: 0.95, heightMeters: 0.8 },
  {
    id: 'armchair',
    category: 'furniture',
    widthMeters: 0.85,
    depthMeters: 0.85,
    heightMeters: 0.8,
  },
  {
    id: 'armchair-wing',
    category: 'furniture',
    widthMeters: 0.82,
    depthMeters: 0.95,
    heightMeters: 1,
  },
  {
    id: 'office-chair',
    category: 'furniture',
    widthMeters: 0.68,
    depthMeters: 0.68,
    heightMeters: 1.1,
  },
  { id: 'table', category: 'furniture', widthMeters: 1.6, depthMeters: 0.9, heightMeters: 0.75 },
  {
    id: 'table-round',
    category: 'furniture',
    widthMeters: 1.05,
    depthMeters: 1.05,
    heightMeters: 0.75,
  },
  {
    id: 'coffee-table',
    category: 'furniture',
    widthMeters: 0.9,
    depthMeters: 0.55,
    heightMeters: 0.45,
  },
  { id: 'desk', category: 'furniture', widthMeters: 1.2, depthMeters: 0.6, heightMeters: 0.75 },
  { id: 'chair', category: 'furniture', widthMeters: 0.45, depthMeters: 0.5, heightMeters: 0.9 },
  { id: 'wardrobe', category: 'furniture', widthMeters: 1.6, depthMeters: 0.6, heightMeters: 2.2 },
  {
    id: 'wardrobe-tall',
    category: 'furniture',
    widthMeters: 1.5,
    depthMeters: 0.6,
    heightMeters: 2.35,
  },
  {
    id: 'wardrobe-sliding',
    category: 'furniture',
    widthMeters: 2,
    depthMeters: 0.65,
    heightMeters: 2.3,
  },
  { id: 'dresser', category: 'furniture', widthMeters: 1, depthMeters: 0.45, heightMeters: 0.9 },
  {
    id: 'dresser-wide',
    category: 'furniture',
    widthMeters: 1.6,
    depthMeters: 0.5,
    heightMeters: 0.95,
  },
  {
    id: 'dresser-tall',
    category: 'furniture',
    widthMeters: 0.8,
    depthMeters: 0.48,
    heightMeters: 1.25,
  },
  {
    id: 'nightstand',
    category: 'furniture',
    widthMeters: 0.5,
    depthMeters: 0.4,
    heightMeters: 0.55,
  },
  {
    id: 'nightstand-tall',
    category: 'furniture',
    widthMeters: 0.4,
    depthMeters: 0.4,
    heightMeters: 0.7,
  },
  { id: 'tv-stand', category: 'furniture', widthMeters: 1.8, depthMeters: 0.4, heightMeters: 1 },
  {
    id: 'bookshelf',
    category: 'furniture',
    widthMeters: 0.8,
    depthMeters: 0.3,
    heightMeters: 1.9,
  },
  {
    id: 'shelving-cube',
    category: 'furniture',
    widthMeters: 0.77,
    depthMeters: 0.39,
    heightMeters: 0.77,
  },
  {
    id: 'kitchen-run',
    category: 'furniture',
    widthMeters: 2.4,
    depthMeters: 0.6,
    heightMeters: 0.9,
  },
  { id: 'fridge', category: 'furniture', widthMeters: 0.6, depthMeters: 0.65, heightMeters: 1.85 },
  { id: 'stove', category: 'furniture', widthMeters: 0.6, depthMeters: 0.6, heightMeters: 0.85 },
  {
    id: 'sink',
    category: 'plumbing',
    widthMeters: 0.6,
    depthMeters: 0.5,
    heightMeters: 0.85,
    utilityKind: 'water',
  },
  {
    id: 'toilet',
    category: 'plumbing',
    widthMeters: 0.4,
    depthMeters: 0.65,
    heightMeters: 0.45,
    utilityKind: 'sewer',
  },
  {
    id: 'shower',
    category: 'plumbing',
    widthMeters: 0.9,
    depthMeters: 0.9,
    heightMeters: 2,
    utilityKind: 'water',
  },
  {
    id: 'bathtub',
    category: 'plumbing',
    widthMeters: 1.7,
    depthMeters: 0.75,
    heightMeters: 0.6,
    utilityKind: 'water',
  },
  {
    id: 'washing-machine',
    category: 'plumbing',
    widthMeters: 0.6,
    depthMeters: 0.6,
    heightMeters: 0.85,
    utilityKind: 'water',
  },
  {
    id: 'boiler',
    category: 'plumbing',
    widthMeters: 0.6,
    depthMeters: 0.6,
    heightMeters: 1.8,
    utilityKind: 'heating',
  },
  {
    id: 'radiator',
    category: 'plumbing',
    widthMeters: 1,
    depthMeters: 0.12,
    heightMeters: 0.6,
    utilityKind: 'heating',
  },
];

export function findFurnitureEntry(id: FurnitureCatalogId): FurnitureCatalogEntry | undefined {
  return FURNITURE_CATALOG.find(entry => entry.id === id);
}

export const DEFAULT_FURNITURE_CATALOG_ID: FurnitureCatalogId = 'bed-double';

/**
 * One placed piece. Elevation is first-class (`building-editor.md` §6, the
 * Sweet Home 3D lesson): height above the storey's floor is what hangs a
 * boiler on a wall or stands a radiator under a window.
 */
export interface FurnitureInstance {
  readonly id: FurnitureId;
  readonly catalogId: FurnitureCatalogId;
  readonly position: Vector2;
  /** Counter-clockwise turn off plan east; the front faces local +y. */
  readonly rotationDegrees: number;
  readonly elevationMeters: Meters;
}

export function createFurniture({
  catalogId,
  position,
}: {
  readonly catalogId: FurnitureCatalogId;
  readonly position: Vector2;
}): FurnitureInstance {
  return {
    id: createFurnitureId(),
    catalogId,
    position,
    rotationDegrees: 0,
    elevationMeters: 0,
  };
}

/** The piece as a turned box on the plan — what picking and drawing share. */
export function furnitureBox(instance: FurnitureInstance): RotatedBox | undefined {
  const entry = findFurnitureEntry(instance.catalogId);

  return entry === undefined
    ? undefined
    : {
        center: instance.position,
        rotationDegrees: instance.rotationDegrees,
        extentX: entry.widthMeters,
        extentY: entry.depthMeters,
      };
}
