import { extrudeFootprint } from '@frozik/utils/geometry/extrudeFootprint';
import type { LitMesh } from '@frozik/utils/geometry/litMesh';
import { EMPTY_LIT_MESH, mergeLitMeshes } from '@frozik/utils/geometry/litMesh';
import type { MultiPolygon, PolygonWithHoles, Ring } from '@frozik/utils/geometry/polygonTypes';
import type { Vector2 } from '@frozik/utils/math/vector2';

import { DEGREES_PER_RADIAN, EARTH_CIRCUMFERENCE_M } from './constants';
import { worldToLonLat } from './mercator';
import type { TileCoord } from './tile-key';
import { tileBounds, tileWorldSize } from './tile-key';

/** A building as one box: its plan in metres from the tile's north-west corner (x east, y north). */
export interface BuildingFootprint {
  readonly polygons: MultiPolygon;
  readonly heightM: number;
  readonly minHeightM: number;
}

/** A ring as the vector tile stores it: integer tile units from the north-west corner, y down. */
export type TileRing = readonly Vector2[];

/** How the tile's integer grid maps onto the ground. */
export interface TileGrid {
  /** Units across the tile, `4096` in every Mapbox vector tile. */
  readonly extent: number;
  readonly tileSizeM: number;
}

const MIN_RING_VERTEX_COUNT = 3;

/** Metres in one Mercator unit at the tile's latitude, where the map's vertical axis must agree with the ground. */
export function metresPerUnitAt(coord: TileCoord): number {
  const bounds = tileBounds(coord);
  const { lat } = worldToLonLat({ x: 0, y: (bounds.minY + bounds.maxY) / 2 });
  return EARTH_CIRCUMFERENCE_M * Math.cos(lat / DEGREES_PER_RADIAN);
}

export function tileGridOf(coord: TileCoord, extent: number): TileGrid {
  return { extent, tileSizeM: tileWorldSize(coord.z) * metresPerUnitAt(coord) };
}

function signedArea(ring: Ring): number {
  let doubled = 0;
  for (let index = 0; index < ring.length; index++) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    doubled += current.x * next.y - next.x * current.y;
  }
  return doubled / 2;
}

/** Winding decides the outward normals of the walls; the source's convention is not trusted, the area is. */
function wound(ring: Ring, counterClockwise: boolean): Ring {
  return signedArea(ring) > 0 === counterClockwise ? ring : ring.toReversed();
}

function toPlan(ring: TileRing, grid: TileGrid): Ring {
  const scale = grid.tileSizeM / grid.extent;
  const open =
    ring.length > 1 &&
    ring[0].x === ring[ring.length - 1].x &&
    ring[0].y === ring[ring.length - 1].y
      ? ring.slice(0, -1)
      : ring;
  return open.map(point => ({ x: point.x * scale, y: -point.y * scale }));
}

/**
 * Groups a feature's rings into polygons: an outer ring opens a polygon and
 * the holes that follow belong to it. In tile space (y down) an outer ring
 * has positive area, which is the Mapbox convention; the rings come out
 * wound the way the extruder wants them, outer counter-clockwise and holes
 * clockwise in plan space (y north).
 */
export function polygonsOfTileRings(rings: readonly TileRing[], grid: TileGrid): MultiPolygon {
  const polygons: PolygonWithHoles[] = [];
  let current: { outer: Ring; holes: Ring[] } | undefined;
  for (const tileRing of rings) {
    if (tileRing.length < MIN_RING_VERTEX_COUNT) {
      continue;
    }
    const isOuter = signedArea(tileRing) > 0;
    const ring = toPlan(tileRing, grid);
    if (isOuter) {
      current = { outer: wound(ring, true), holes: [] };
      polygons.push(current);
    } else {
      current?.holes.push(wound(ring, false));
    }
  }
  return polygons;
}

/** Every footprint of a tile as one mesh in metres from the tile's north-west corner, y up, z south. */
export function buildingTileMesh(footprints: readonly BuildingFootprint[]): LitMesh {
  const meshes = footprints
    .filter(footprint => footprint.heightM > footprint.minHeightM)
    .map(footprint =>
      extrudeFootprint({
        polygons: footprint.polygons,
        padElevation: footprint.minHeightM,
        wallHeight: footprint.heightM - footprint.minHeightM,
      })
    );
  return mergeLitMeshes(meshes) ?? EMPTY_LIT_MESH;
}
