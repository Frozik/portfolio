import type { MultiPolygon, PolygonWithHoles, Ring } from '@frozik/utils/geometry/polygonTypes';
import { triangulatePolygon } from '@frozik/utils/geometry/triangulatePolygon';

import { STREET_MESH_UNIT_M } from './constants';
import { signedArea } from './ring-area';
import type { TileGrid, TileRing } from './tile-grid';
import { toPlan } from './tile-grid';

/** A building as one box: its plan in metres from the tile's north-west corner (x east, y north). */
export interface BuildingFootprint {
  readonly polygons: MultiPolygon;
  readonly heightM: number;
  readonly minHeightM: number;
}

const MIN_RING_VERTEX_COUNT = 3;

/** Winding decides the outward normals of the walls; the source's convention is not trusted, the area is. */
function wound(ring: Ring, counterClockwise: boolean): Ring {
  return signedArea(ring) > 0 === counterClockwise ? ring : ring.toReversed();
}

function withoutClosingPoint(ring: TileRing): TileRing {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return ring.length > 1 && first.x === last.x && first.y === last.y ? ring.slice(0, -1) : ring;
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
    const ring = toPlan(withoutClosingPoint(tileRing), grid);
    if (isOuter) {
      current = { outer: wound(ring, true), holes: [] };
      polygons.push(current);
    } else {
      current?.holes.push(wound(ring, false));
    }
  }
  return polygons;
}

/**
 * Building boxes as the GPU takes them: every ring vertex twice, at the
 * base and at the roof, as four `int16` (x east, y up, z south, unused) in
 * tenths of a metre from the tile's north-west corner — a dense city tile
 * runs to a hundred thousand vertices, and flat faces need no normals, the
 * shader derives them. Walls join the two rings, the roof is the polygon
 * triangulated.
 */
export interface BuildingMesh {
  readonly positions: Int16Array;
  readonly indices: Uint32Array;
}

function quantized(metres: number): number {
  return Math.round(metres / STREET_MESH_UNIT_M);
}

/** The roof triangulation indexes the rings in this order, so the box's vertices follow it. */
function ringsOf(polygon: PolygonWithHoles): readonly Ring[] {
  return [polygon.outer, ...polygon.holes.filter(hole => hole.length >= MIN_RING_VERTEX_COUNT)];
}

interface BoxBuilder {
  readonly positions: number[];
  readonly indices: number[];
  vertexCount: number;
}

function appendBox(
  builder: BoxBuilder,
  polygon: PolygonWithHoles,
  footprint: BuildingFootprint
): void {
  const rings = ringsOf(polygon);
  const roof = triangulatePolygon({ outer: rings[0], holes: rings.slice(1) });
  const ringVertexCount = rings.reduce((sum, ring) => sum + ring.length, 0);
  if (roof.indices.length === 0 || roof.positions.length !== ringVertexCount * 2) {
    return;
  }
  const top = builder.vertexCount;
  const bottom = top + ringVertexCount;
  for (const elevation of [footprint.heightM, footprint.minHeightM]) {
    for (const ring of rings) {
      for (const point of ring) {
        builder.positions.push(quantized(point.x), quantized(elevation), quantized(-point.y), 0);
      }
    }
  }
  builder.vertexCount += ringVertexCount * 2;
  for (const index of roof.indices) {
    builder.indices.push(top + index);
  }
  let ringStart = 0;
  for (const ring of rings) {
    for (let index = 0; index < ring.length; index++) {
      const from = ringStart + index;
      const to = ringStart + ((index + 1) % ring.length);
      builder.indices.push(
        top + from,
        top + to,
        bottom + to,
        top + from,
        bottom + to,
        bottom + from
      );
    }
    ringStart += ring.length;
  }
}

/** Every footprint of a tile as one mesh in tenths of a metre from the tile's north-west corner, y up, z south. */
export function buildingTileMesh(footprints: readonly BuildingFootprint[]): BuildingMesh {
  const builder: BoxBuilder = { positions: [], indices: [], vertexCount: 0 };
  for (const footprint of footprints) {
    if (footprint.heightM <= footprint.minHeightM) {
      continue;
    }
    for (const polygon of footprint.polygons) {
      if (polygon.outer.length >= MIN_RING_VERTEX_COUNT) {
        appendBox(builder, polygon, footprint);
      }
    }
  }
  return {
    positions: Int16Array.from(builder.positions),
    indices: Uint32Array.from(builder.indices),
  };
}
