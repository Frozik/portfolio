import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import type { Meters } from '../units';
import { removeById, replaceById } from './edit-collections';
import type {
  CarId,
  CarInstance,
  ElevationMark,
  MarkId,
  PathId,
  PathPoint,
  PathSurface,
  SitePath,
  TreeId,
  TreeInstance,
} from './site-plan';

export function addMark(
  marks: readonly ElevationMark[],
  mark: ElevationMark
): readonly ElevationMark[] {
  return [...marks, mark];
}

export function moveMark(
  marks: readonly ElevationMark[],
  markId: MarkId,
  position: Vector2
): readonly ElevationMark[] {
  return replaceById(marks, markId, mark => ({ ...mark, position }));
}

export function setMarkElevation(
  marks: readonly ElevationMark[],
  markId: MarkId,
  elevation: Meters
): readonly ElevationMark[] {
  return replaceById(marks, markId, mark => ({ ...mark, elevation }));
}

export function removeMark(
  marks: readonly ElevationMark[],
  markId: MarkId
): readonly ElevationMark[] {
  return removeById(marks, markId);
}

export function addTree(
  trees: readonly TreeInstance[],
  tree: TreeInstance
): readonly TreeInstance[] {
  return [...trees, tree];
}

export function updateTree(
  trees: readonly TreeInstance[],
  tree: TreeInstance
): readonly TreeInstance[] {
  return replaceById(trees, tree.id, () => tree);
}

export function removeTree(
  trees: readonly TreeInstance[],
  treeId: TreeId
): readonly TreeInstance[] {
  return removeById(trees, treeId);
}

export function addCar(cars: readonly CarInstance[], car: CarInstance): readonly CarInstance[] {
  return [...cars, car];
}

export function updateCar(cars: readonly CarInstance[], car: CarInstance): readonly CarInstance[] {
  return replaceById(cars, car.id, () => car);
}

export function removeCar(cars: readonly CarInstance[], carId: CarId): readonly CarInstance[] {
  return removeById(cars, carId);
}

export function addPath(paths: readonly SitePath[], path: SitePath): readonly SitePath[] {
  return [...paths, path];
}

/** Extends the polyline; the new point walks on at the width and paving the path ended with. */
export function appendPathPoint(
  paths: readonly SitePath[],
  pathId: PathId,
  position: Vector2
): readonly SitePath[] {
  return replaceById(paths, pathId, path => {
    const last = path.points[path.points.length - 1];

    return { ...path, points: [...path.points, { ...last, position }] };
  });
}

/** One width for the whole ribbon: written into every point. */
export function updatePathWidth(
  paths: readonly SitePath[],
  pathId: PathId,
  width: Meters
): readonly SitePath[] {
  return replaceById(paths, pathId, path => ({
    ...path,
    points: path.points.map(point => ({ ...point, width })),
  }));
}

/** Repaves the segment after `segmentIndex` — the surface lives on its first point. */
export function setPathSegmentSurface(
  paths: readonly SitePath[],
  pathId: PathId,
  segmentIndex: number,
  surface: PathSurface
): readonly SitePath[] {
  return replaceById(paths, pathId, path => ({
    ...path,
    points: path.points.map((point, index) =>
      index === segmentIndex ? { ...point, surface } : point
    ),
  }));
}

export function setPathPointWidth(
  paths: readonly SitePath[],
  pathId: PathId,
  pointIndex: number,
  width: Meters
): readonly SitePath[] {
  return replaceById(paths, pathId, path => ({
    ...path,
    points: path.points.map((point, index) => (index === pointIndex ? { ...point, width } : point)),
  }));
}

/** Replaces a path whole — the restore half of an interrupted point drag. */
export function updatePath(paths: readonly SitePath[], path: SitePath): readonly SitePath[] {
  return replaceById(paths, path.id, () => path);
}

/** A ribbon is the offset of a segment, so a path is never trimmed below two points. */
export const MIN_PATH_POINTS = 2;

export function movePathPoint(
  paths: readonly SitePath[],
  pathId: PathId,
  pointIndex: number,
  position: Vector2
): readonly SitePath[] {
  return replaceById(paths, pathId, path => ({
    ...path,
    points: path.points.map((existing, index) =>
      index === pointIndex ? { ...existing, position } : existing
    ),
  }));
}

/**
 * Splits the segment after `segmentIndex` by planting a new point inside it.
 * The point inherits the ribbon's width where it lands — planting alone never
 * reshapes the ribbon.
 */
export function insertPathPoint(
  paths: readonly SitePath[],
  pathId: PathId,
  segmentIndex: number,
  position: Vector2
): readonly SitePath[] {
  return replaceById(paths, pathId, path => {
    const start = path.points[segmentIndex];
    const end = path.points[segmentIndex + 1];
    const width = isNil(start) || isNil(end) ? path.points[0].width : widthAt(start, end, position);

    return {
      ...path,
      points: [
        ...path.points.slice(0, segmentIndex + 1),
        // Splitting a segment keeps its paving on both halves.
        { position, width, surface: start?.surface },
        ...path.points.slice(segmentIndex + 1),
      ],
    };
  });
}

/** The interpolated ribbon width where `position` projects onto the segment. */
function widthAt(start: PathPoint, end: PathPoint, position: Vector2): Meters {
  const segmentX = end.position.x - start.position.x;
  const segmentY = end.position.y - start.position.y;
  const squaredLength = segmentX * segmentX + segmentY * segmentY;

  if (squaredLength === 0) {
    return start.width;
  }

  const projection = Math.min(
    1,
    Math.max(
      0,
      ((position.x - start.position.x) * segmentX + (position.y - start.position.y) * segmentY) /
        squaredLength
    )
  );

  return start.width + (end.width - start.width) * projection;
}

export function removePathPoint(
  paths: readonly SitePath[],
  pathId: PathId,
  pointIndex: number
): readonly SitePath[] {
  const path = paths.find(candidate => candidate.id === pathId);

  if (isNil(path) || path.points.length <= MIN_PATH_POINTS) {
    return paths;
  }

  return replaceById(paths, pathId, () => ({
    ...path,
    points: path.points.filter((_, index) => index !== pointIndex),
  }));
}

export function removePath(paths: readonly SitePath[], pathId: PathId): readonly SitePath[] {
  return removeById(paths, pathId);
}
