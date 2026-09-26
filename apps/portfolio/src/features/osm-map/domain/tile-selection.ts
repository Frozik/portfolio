import {
  LOD_THRESHOLD_PX,
  MAX_TILES_PER_FRAME,
  MAX_ZOOM,
  TILE_BUDGET_COARSEN_FACTOR,
  TILE_BUDGET_MAX_ROUNDS,
} from './constants';
import { distanceToGroundRect, frustumPlanes, intersectsGroundRect } from './frustum';
import type { CameraGeometry } from './map-camera';
import { projectGround } from './map-camera';
import type { GroundRect, TileCoord, TileKey } from './tile-key';
import { childrenOf, ROOT_TILE, tileBounds, tileKeyOf, tileWorldSize } from './tile-key';

export interface SelectedTile {
  readonly key: TileKey;
  readonly coord: TileCoord;
  /** Projected edge length in device pixels — bigger means nearer; the frame budget cuts the smallest. */
  readonly edgePx: number;
  /** How far the tile's centre lands from the screen centre, in device pixels: the load priority. */
  readonly screenDistancePx: number;
}

const MIN_DISTANCE_EPSILON = 1e-9;
/** A tile whose centre is behind the camera still shows an edge, but loads after everything else. */
const BEHIND_CAMERA_DISTANCE_PX = Number.MAX_VALUE;

/** Nearest to the screen centre first. */
export function compareByScreenDistance(first: SelectedTile, second: SelectedTile): number {
  return first.screenDistancePx - second.screenDistancePx;
}

function screenDistancePx(geometry: CameraGeometry, bounds: GroundRect): number {
  const centre = projectGround(geometry, {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  });
  if (centre === undefined) {
    return BEHIND_CAMERA_DISTANCE_PX;
  }
  const { widthPx, heightPx } = geometry.viewport;
  return Math.hypot(centre.x - widthPx / 2, centre.y - heightPx / 2);
}

/**
 * Walks the tile quadtree and keeps every visible tile whose projected edge
 * fits under the threshold: fine tiles near the camera, coarse ones toward
 * the horizon. The result partitions the visible ground, sorted nearest first.
 * When it would exceed the per-frame budget the threshold is coarsened and
 * the walk repeated (MapLibre's tile-count rule); whatever still exceeds it
 * after the last round is cut at the far end.
 */
export function selectTiles(
  geometry: CameraGeometry,
  detailFactor: number
): readonly SelectedTile[] {
  let threshold = LOD_THRESHOLD_PX / detailFactor;
  let selected = walk(geometry, threshold);
  for (
    let round = 0;
    round < TILE_BUDGET_MAX_ROUNDS && selected.length > MAX_TILES_PER_FRAME;
    round++
  ) {
    threshold *= TILE_BUDGET_COARSEN_FACTOR;
    selected = walk(geometry, threshold);
  }
  return selected
    .toSorted((first, second) => second.edgePx - first.edgePx)
    .slice(0, MAX_TILES_PER_FRAME);
}

function walk(geometry: CameraGeometry, thresholdPx: number): SelectedTile[] {
  const planes = frustumPlanes(geometry.viewProjection, geometry.origin);
  const selected: SelectedTile[] = [];
  const pending: TileCoord[] = [ROOT_TILE];
  for (let coord = pending.pop(); coord !== undefined; coord = pending.pop()) {
    const bounds = tileBounds(coord);
    if (!intersectsGroundRect(planes, bounds)) {
      continue;
    }
    const distance = distanceToGroundRect(geometry.position, bounds);
    if (distance > geometry.fogEnd) {
      continue;
    }
    const edgePx =
      (tileWorldSize(coord.z) * geometry.focalPx) / Math.max(distance, MIN_DISTANCE_EPSILON);
    if (edgePx > thresholdPx && coord.z < MAX_ZOOM) {
      pending.push(...childrenOf(coord));
    } else {
      selected.push({
        key: tileKeyOf(coord),
        coord,
        edgePx,
        screenDistancePx: screenDistancePx(geometry, bounds),
      });
    }
  }
  return selected;
}
