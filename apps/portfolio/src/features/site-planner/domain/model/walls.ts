import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';

import type { Meters } from '../units';

export type WallId = Opaque<'WallId', string>;

/**
 * What a wall is built of — the user-named set plus glazing (`building-editor.md`
 * §4, R5/R21). A catalog of data, not of behaviour: the material only carries a
 * default thickness and a look; every wall stays editable past its preset.
 */
export type WallMaterial =
  | 'brick'
  | 'ceramic-block'
  | 'foam-concrete'
  | 'timber'
  | 'frame'
  | 'glazing';

/** Every material, in the order the panel offers them. */
export const WALL_MATERIALS: readonly WallMaterial[] = [
  'brick',
  'ceramic-block',
  'foam-concrete',
  'timber',
  'frame',
  'glazing',
];

/** Narrows the string a dropdown reports back to the material it stands for. */
export function parseWallMaterial(value: string): WallMaterial | undefined {
  return WALL_MATERIALS.find(material => material === value);
}

/** Typical built thicknesses, the default a freshly drawn wall starts at. */
export const WALL_MATERIAL_DEFAULT_THICKNESS: Readonly<Record<WallMaterial, Meters>> = {
  brick: 0.38,
  'ceramic-block': 0.44,
  'foam-concrete': 0.3,
  timber: 0.2,
  frame: 0.2,
  glazing: 0.05,
};

/**
 * Which line of the wall the drawn polyline pins (`building-editor.md` §4, the
 * ArchiCAD/Revit convention): the outer face for exterior walls — the facade
 * stays put while thickness grows inward — or the centreline for partitions.
 */
export type WallReferenceLine = 'outer-face' | 'centerline';

export const WALL_REFERENCE_LINES: readonly WallReferenceLine[] = ['outer-face', 'centerline'];

export function parseWallReferenceLine(value: string): WallReferenceLine | undefined {
  return WALL_REFERENCE_LINES.find(line => line === value);
}

/**
 * One wall as a chain of drawn points with a construction: the exact pattern a
 * path is, which is why the point-editing kit transfers. The body polygon is
 * derived (`domain/geometry/wall-geometry.ts`), never stored.
 */
export interface Wall {
  readonly id: WallId;
  /** The drawn reference polyline; at least two points, never repeating the first. */
  readonly points: readonly Vector2[];
  readonly material: WallMaterial;
  readonly thicknessMeters: Meters;
  readonly referenceLine: WallReferenceLine;
  /**
   * A closed contour: the last point connects back to the first, and the body
   * mitres at the seam like at any other corner. Absent in walls saved before
   * rings existed — read via {@link isWallClosed}.
   */
  readonly isClosed?: boolean;
}

/** Whether the wall runs as a ring, defaulted for walls that predate the flag. */
export function isWallClosed(wall: Wall): boolean {
  return wall.isClosed ?? false;
}

export const MIN_WALL_POINTS = 2;
/** A ring needs a triangle's worth of corners; two points close into nothing. */
export const MIN_CLOSED_WALL_POINTS = 3;

const DEFAULT_WALL_MATERIAL: WallMaterial = 'brick';

/**
 * The default a drawn wall starts on. Centreline rather than the exterior
 * convention: a single tool cannot know which role a wall will play, and a
 * centred body is the predictable one — the reference line flips in the
 * properties panel (`building-editor.md` §4).
 */
const DEFAULT_WALL_REFERENCE_LINE: WallReferenceLine = 'centerline';

/** Mints a wall of the given material at that material's typical thickness. */
export function createWall({
  points,
  material = DEFAULT_WALL_MATERIAL,
}: {
  readonly points: readonly Vector2[];
  readonly material?: WallMaterial;
}): Wall {
  return {
    id: crypto.randomUUID() as WallId,
    points,
    material,
    thicknessMeters: WALL_MATERIAL_DEFAULT_THICKNESS[material],
    referenceLine: DEFAULT_WALL_REFERENCE_LINE,
  };
}
