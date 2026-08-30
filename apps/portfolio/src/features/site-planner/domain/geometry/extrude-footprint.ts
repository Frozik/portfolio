import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import type { Meters } from '../units';
import type { WorldPoint } from '../view/world-frame';
import { planToWorld } from '../view/world-frame';
import type { LitMesh } from './lit-mesh';
import { EMPTY_LIT_MESH } from './lit-mesh';
import type { MultiPolygon, Ring } from './polygon-types';
import { triangulateMultiPolygon } from './triangulate-polygon';

/** A unit direction in world space; it shares the tuple shape of a position. */
type WorldNormal = WorldPoint;

const COORDINATES_PER_PLAN_VERTEX = 2;
const WORLD_COORDINATES_PER_VERTEX = 3;
const MIN_RING_VERTEX_COUNT = 3;
/** An edge this short has no direction to take an outward normal from. */
const MIN_EDGE_LENGTH_METERS: Meters = 1e-9;
/** Upwards in world space — the facing of the roof slab. */
const UP_NORMAL: WorldNormal = [0, 1, 0];

/** Vertex buffers under construction, shared by the roof and every side band. */
interface MeshBuilder {
  readonly positions: number[];
  readonly normals: number[];
  readonly indices: number[];
}

/**
 * Turns a building footprint into the solid the 3D view draws.
 *
 * The house does not follow the ground: the footprint is levelled onto a pad and
 * the walls rise from it, which is the convention every architectural tool
 * settles on (the terrain is what gets cut and filled to meet the pad instead).
 * That leaves a house on a slope hanging over the low side, so the walls are
 * carried on below the pad as an apron down to `apronBaseElevation` — buried on
 * the high side, closing the gap on the low one.
 *
 * The result is three parts in one mesh: the roof slab at `padElevation +
 * wallHeight`, the walls between the pad and the roof, and the apron below the
 * pad. Their normals are what the shader tells them apart by, so every side quad
 * carries the outward normal of its edge — which the ring winding gives for free:
 * outer rings run counter-clockwise and holes clockwise, so the same formula
 * points away from the material in both.
 */
export function extrudeFootprint({
  polygons,
  padElevation,
  wallHeight,
  apronBaseElevation,
}: {
  readonly polygons: MultiPolygon;
  readonly padElevation: Meters;
  readonly wallHeight: Meters;
  readonly apronBaseElevation: Meters;
}): LitMesh {
  const builder: MeshBuilder = { positions: [], normals: [], indices: [] };
  const roofElevation = padElevation + wallHeight;

  appendRoof(builder, polygons, roofElevation);

  for (const polygon of polygons) {
    appendRingBands(builder, polygon.outer, { padElevation, roofElevation, apronBaseElevation });

    for (const hole of polygon.holes) {
      appendRingBands(builder, hole, { padElevation, roofElevation, apronBaseElevation });
    }
  }

  if (builder.indices.length === 0) {
    return EMPTY_LIT_MESH;
  }

  return {
    positions: Float32Array.from(builder.positions),
    normals: Float32Array.from(builder.normals),
    indices: Uint32Array.from(builder.indices),
  };
}

/**
 * A closed prism between two elevations: top cap, bottom cap and the side
 * band. What a lintel over a doorway and the masonry under a window sill are —
 * unlike {@link extrudeFootprint} it has a real underside, because a lintel is
 * looked at from below.
 */
export function extrudePrism({
  polygons,
  baseElevation,
  topElevation,
}: {
  readonly polygons: MultiPolygon;
  readonly baseElevation: Meters;
  readonly topElevation: Meters;
}): LitMesh {
  if (topElevation <= baseElevation) {
    return EMPTY_LIT_MESH;
  }

  const builder: MeshBuilder = { positions: [], normals: [], indices: [] };

  appendRoof(builder, polygons, topElevation);
  appendFloor(builder, polygons, baseElevation);

  for (const polygon of polygons) {
    appendBand(builder, polygon.outer, baseElevation, topElevation);

    for (const hole of polygon.holes) {
      appendBand(builder, hole, baseElevation, topElevation);
    }
  }

  if (builder.indices.length === 0) {
    return EMPTY_LIT_MESH;
  }

  return {
    positions: Float32Array.from(builder.positions),
    normals: Float32Array.from(builder.normals),
    indices: Uint32Array.from(builder.indices),
  };
}

/** The underside of a prism: the same cap facing down, wound the other way. */
function appendFloor(builder: MeshBuilder, polygons: MultiPolygon, floorElevation: Meters): void {
  const cap = triangulateMultiPolygon(polygons);
  const firstVertex = countVertices(builder);
  const DOWN_NORMAL: WorldNormal = [0, -1, 0];

  for (
    let offset = 0;
    offset + COORDINATES_PER_PLAN_VERTEX <= cap.positions.length;
    offset += COORDINATES_PER_PLAN_VERTEX
  ) {
    appendVertex(
      builder,
      { x: cap.positions[offset], y: cap.positions[offset + 1] },
      floorElevation,
      DOWN_NORMAL
    );
  }

  for (let index = 0; index + 3 <= cap.indices.length; index += 3) {
    builder.indices.push(
      firstVertex + cap.indices[index],
      firstVertex + cap.indices[index + 2],
      firstVertex + cap.indices[index + 1]
    );
  }
}

/** The flat top of the house: the triangulated footprint lifted to the roof. */
function appendRoof(builder: MeshBuilder, polygons: MultiPolygon, roofElevation: Meters): void {
  const cap = triangulateMultiPolygon(polygons);
  const firstVertex = countVertices(builder);

  for (
    let offset = 0;
    offset + COORDINATES_PER_PLAN_VERTEX <= cap.positions.length;
    offset += COORDINATES_PER_PLAN_VERTEX
  ) {
    appendVertex(
      builder,
      { x: cap.positions[offset], y: cap.positions[offset + 1] },
      roofElevation,
      UP_NORMAL
    );
  }

  for (const index of cap.indices) {
    builder.indices.push(firstVertex + index);
  }
}

/** The walls and the apron of one ring, both raised on the ring's own edges. */
function appendRingBands(
  builder: MeshBuilder,
  ring: Ring,
  {
    padElevation,
    roofElevation,
    apronBaseElevation,
  }: {
    readonly padElevation: Meters;
    readonly roofElevation: Meters;
    readonly apronBaseElevation: Meters;
  }
): void {
  if (ring.length < MIN_RING_VERTEX_COUNT) {
    return;
  }

  appendBand(builder, ring, padElevation, roofElevation);
  appendBand(builder, ring, apronBaseElevation, padElevation);
}

/** One vertical band along a ring, from `lowerElevation` up to `upperElevation`. */
function appendBand(
  builder: MeshBuilder,
  ring: Ring,
  lowerElevation: Meters,
  upperElevation: Meters
): void {
  if (upperElevation <= lowerElevation) {
    return;
  }

  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    const normal = computeOutwardNormal(start, end);

    if (isNil(normal)) {
      continue;
    }

    const firstVertex = countVertices(builder);

    appendVertex(builder, start, upperElevation, normal);
    appendVertex(builder, end, upperElevation, normal);
    appendVertex(builder, end, lowerElevation, normal);
    appendVertex(builder, start, lowerElevation, normal);

    builder.indices.push(
      firstVertex,
      firstVertex + 1,
      firstVertex + 2,
      firstVertex,
      firstVertex + 2,
      firstVertex + 3
    );
  }
}

/**
 * The horizontal normal of the wall raised on `start → end`. A ring bounds
 * material on its left (plan `y` runs north), so rotating the edge direction to
 * its right points away from what the ring encloses. The result is taken through
 * {@link planToWorld} like every other direction in the feature — the transform
 * is a pure axis mirror, so it maps a direction as faithfully as a position.
 */
function computeOutwardNormal(start: Vector2, end: Vector2): WorldNormal | undefined {
  const edgeX = end.x - start.x;
  const edgeY = end.y - start.y;
  const length = Math.hypot(edgeX, edgeY);

  if (length < MIN_EDGE_LENGTH_METERS) {
    return undefined;
  }

  return planToWorld({ x: edgeY / length, y: -edgeX / length }, 0);
}

function appendVertex(
  builder: MeshBuilder,
  point: Vector2,
  elevation: Meters,
  normal: WorldNormal
): void {
  const [x, y, z] = planToWorld(point, elevation);
  const [normalX, normalY, normalZ] = normal;

  builder.positions.push(x, y, z);
  builder.normals.push(normalX, normalY, normalZ);
}

/** Vertices already written; positions and normals advance in lockstep. */
function countVertices(builder: MeshBuilder): number {
  return builder.positions.length / WORLD_COORDINATES_PER_VERTEX;
}
