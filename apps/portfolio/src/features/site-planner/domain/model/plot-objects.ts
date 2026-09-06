import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';
import { DEFAULT_CAR_ROTATION_DEGREES } from '../constants';
import type { Meters } from '../units';
import { normalizeTurnDegrees } from '../units';

/** What stands on the plot outside the buildings: trees, cars and the paths between them. */
export type TreeId = Opaque<'TreeId', string>;

export type PathId = Opaque<'PathId', string>;

export type CarId = Opaque<'CarId', string>;

/**
 * The kinds of tree the catalogue plants. Named species rather than families —
 * a spruce, a pine and a thuja are three silhouettes on a garden plan, and a
 * plan that only knew "conifer" could not tell a column of thujas along a fence
 * from the spruce standing over the house.
 */
export type TreeSpecies = 'spruce' | 'pine' | 'thuja' | 'deciduous';

/** Every species, in the order the catalogue offers them. */
export const TREE_SPECIES: readonly TreeSpecies[] = ['spruce', 'pine', 'thuja', 'deciduous'];

/** Narrows the string a radio group reports back to the species it stands for. */
export function parseTreeSpecies(value: string): TreeSpecies | undefined {
  return TREE_SPECIES.find(species => species === value);
}

export interface TreeInstance {
  readonly id: TreeId;
  readonly species: TreeSpecies;
  readonly position: Vector2;
  readonly crownRadius: Meters;
  readonly height: Meters;
}

export interface TreeSize {
  readonly crownRadius: Meters;
  readonly height: Meters;
}

/**
 * What a freshly planted tree of each species measures: a typical garden
 * specimen rather than a forest record. Spruces and pines carry the plot's
 * vertical scale, a broadleaf spreads wider than it is regular, and a thuja is
 * a hedge column — man-high and narrow — which is exactly why it must not
 * inherit a spruce's six metres.
 */
export const TREE_SPECIES_DEFAULT_SIZES: Readonly<Record<TreeSpecies, TreeSize>> = {
  spruce: { crownRadius: 2, height: 10 },
  pine: { crownRadius: 2.5, height: 12 },
  thuja: { crownRadius: 0.75, height: 3 },
  deciduous: { crownRadius: 2.5, height: 8 },
};

/**
 * Re-labels a tree with another species. A size the user never touched — one
 * still equal to the old species' default — follows the new species, so a
 * spruce turned into a thuja becomes thuja-sized; a size typed by hand is the
 * user's own measurement and stays.
 */
export function changeTreeSpecies(tree: TreeInstance, species: TreeSpecies): TreeInstance {
  const oldDefault = TREE_SPECIES_DEFAULT_SIZES[tree.species];
  const isUntouched =
    tree.crownRadius === oldDefault.crownRadius && tree.height === oldDefault.height;

  return { ...tree, species, ...(isUntouched ? TREE_SPECIES_DEFAULT_SIZES[species] : {}) };
}

/**
 * A parked car. It carries no dimensions of its own: a car is a typical object
 * on a garden plan the way a door is on a floor plan, so its size lives in
 * `domain/constants.ts` and only where it stands and which way it faces are
 * part of the document.
 */
export interface CarInstance {
  readonly id: CarId;
  readonly position: Vector2;
  /** Counter-clockwise turn of the car's nose off plan east, in degrees. */
  readonly rotationDegrees: number;
}

/** What a stretch of path is paved with; the colour on the plan and in 3D. */
export type PathSurface = 'dirt' | 'asphalt';

/** Every surface, in the order the segment panel offers them. */
export const PATH_SURFACES: readonly PathSurface[] = ['dirt', 'asphalt'];

/**
 * Paths predate the surface, so its absence stays a valid document and reads
 * as the asphalt every existing ribbon was drawn as.
 */
const DEFAULT_PATH_SURFACE: PathSurface = 'asphalt';

/**
 * One bend of a path, carrying the ribbon's full width where it passes through
 * and the surface of the segment that STARTS here (the last point's surface
 * goes unread). Keeping the surface on the point is what lets inserts and
 * removals of points carry the paving along with no bookkeeping at all.
 */
export interface PathPoint {
  readonly position: Vector2;
  readonly width: Meters;
  readonly surface?: PathSurface;
}

export function pathSurfaceAt(point: PathPoint): PathSurface {
  return point.surface ?? DEFAULT_PATH_SURFACE;
}

/**
 * A polyline whose width belongs to its points: the ribbon interpolates
 * between them, so a drive can widen towards the gate along one drawn line.
 */
export interface SitePath {
  readonly id: PathId;
  readonly points: readonly PathPoint[];
}

/** The one width every point shares, or nothing when the ribbon varies. */
export function uniformPathWidth(path: SitePath): Meters | undefined {
  const [first] = path.points;

  return path.points.every(point => point.width === first.width) ? first.width : undefined;
}

export function createTreeId(): TreeId {
  return crypto.randomUUID() as TreeId;
}

export function createPathId(): PathId {
  return crypto.randomUUID() as PathId;
}

export function createCarId(): CarId {
  return crypto.randomUUID() as CarId;
}

/** Mints an identity for a tree the user has just planted. */
export function createTree({
  species,
  position,
  crownRadius,
  height,
}: {
  readonly species: TreeSpecies;
  readonly position: Vector2;
  readonly crownRadius: Meters;
  readonly height: Meters;
}): TreeInstance {
  return { id: createTreeId(), species, position, crownRadius, height };
}

/** Mints an identity for a car the user has just parked. */
export function createCar({
  position,
  rotationDegrees = DEFAULT_CAR_ROTATION_DEGREES,
}: {
  readonly position: Vector2;
  readonly rotationDegrees?: number;
}): CarInstance {
  return {
    id: createCarId(),
    position,
    rotationDegrees: normalizeTurnDegrees(rotationDegrees),
  };
}

/** Mints an identity for a path the user has just finished drawing. */
export function createSitePath({
  points,
  width,
}: {
  readonly points: readonly Vector2[];
  readonly width: Meters;
}): SitePath {
  return { id: createPathId(), points: points.map(position => ({ position, width })) };
}
