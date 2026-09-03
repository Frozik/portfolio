import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Meters } from '../units';
import type { WorldPoint } from '../view/world-frame';
import { planToWorld } from '../view/world-frame';
import type { LitMesh } from './lit-mesh';
import { EMPTY_LIT_MESH } from './lit-mesh';
import type { RoofFace, RoofFrame } from './pitched-roof';
import { roofHeightAt } from './pitched-roof';
import type { MultiPolygon, Ring } from './polygon-types';
import { triangulateMultiPolygon } from './triangulate-polygon';

const COORDINATES_PER_PLAN_VERTEX = 2;
const WORLD_COORDINATES_PER_VERTEX = 3;
const MIN_RING_VERTEX_COUNT = 3;
const MIN_EDGE_LENGTH_METERS: Meters = 1e-9;
/** Two planes closer than this along a whole edge are the same plane. */
const CROSSING_EPSILON = 1e-9;

interface MeshBuilder {
  readonly positions: number[];
  readonly normals: number[];
  readonly indices: number[];
}

/**
 * The roof as a solid (`building-editor.md` §5, R33): every slope lifted onto
 * its own plane, the same slopes again a thickness below as the soffit, a
 * fascia band around the eaves, and — for a gable or a shed — the wall triangle
 * that closes each end above the storey's own walls.
 *
 * It is a SOLID rather than a surface because everything else here is: the
 * shadow the sun study casts, the section a viewer sees from below and the
 * silhouette against the sky all come out wrong when a roof is one-sided.
 */
export function buildPitchedRoofMesh({
  faces,
  frame,
  footprint,
  eaveElevation,
  thicknessMeters,
}: {
  readonly faces: readonly RoofFace[];
  readonly frame: RoofFrame;
  /** The storey outline the gable walls stand on; the plan itself is wider. */
  readonly footprint: MultiPolygon;
  /** Where the slopes start: the top of the storey's ceiling slab. */
  readonly eaveElevation: Meters;
  readonly thicknessMeters: Meters;
}): LitMesh {
  const builder: MeshBuilder = { positions: [], normals: [], indices: [] };

  for (const face of faces) {
    const height = (point: Vector2): Meters =>
      eaveElevation + roofHeightAt(frame, face.plane, point);

    appendSlope(builder, face, height, frame, { isUnderside: false, thicknessMeters });
    appendSlope(builder, face, height, frame, { isUnderside: true, thicknessMeters });

    for (const polygon of face.polygons) {
      appendFascia(builder, polygon.outer, height, thicknessMeters);

      for (const hole of polygon.holes) {
        appendFascia(builder, hole, height, thicknessMeters);
      }
    }
  }

  appendGableWalls(builder, { faces, frame, footprint, eaveElevation, thicknessMeters });

  if (builder.indices.length === 0) {
    return EMPTY_LIT_MESH;
  }

  return {
    positions: Float32Array.from(builder.positions),
    normals: Float32Array.from(builder.normals),
    indices: Uint32Array.from(builder.indices),
  };
}

/** One slope, or the same slope a thickness below it facing the other way. */
function appendSlope(
  builder: MeshBuilder,
  face: RoofFace,
  height: (point: Vector2) => Meters,
  frame: RoofFrame,
  {
    isUnderside,
    thicknessMeters,
  }: { readonly isUnderside: boolean; readonly thicknessMeters: Meters }
): void {
  const mesh = triangulateMultiPolygon(face.polygons);
  const firstVertex = countVertices(builder);
  const normal = slopeNormal(face, frame, isUnderside);
  const drop = isUnderside ? thicknessMeters : 0;

  for (
    let offset = 0;
    offset + COORDINATES_PER_PLAN_VERTEX <= mesh.positions.length;
    offset += COORDINATES_PER_PLAN_VERTEX
  ) {
    const point = { x: mesh.positions[offset], y: mesh.positions[offset + 1] };

    appendVertex(builder, planToWorld(point, height(point) - drop), normal);
  }

  for (let index = 0; index + 2 < mesh.indices.length; index += 3) {
    const [first, second, third] = [
      firstVertex + mesh.indices[index],
      firstVertex + mesh.indices[index + 1],
      firstVertex + mesh.indices[index + 2],
    ];

    // The underside faces the other way, so its triangles are wound the other way.
    builder.indices.push(first, ...(isUnderside ? [third, second] : [second, third]));
  }
}

/**
 * The upward normal of a slope in world space. The plane climbs `du` along the
 * frame's local x and `dv` along its local y; turned into plan axes, that is
 * the gradient the surface leans away from.
 */
function slopeNormal(face: RoofFace, frame: RoofFrame, isUnderside: boolean): WorldPoint {
  const angle = frame.rotationDegrees * (Math.PI / 180);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const gradientX = face.plane.du * cosine - face.plane.dv * sine;
  const gradientY = face.plane.du * sine + face.plane.dv * cosine;
  const length = Math.hypot(gradientX, gradientY, 1);
  const sign = isUnderside ? -1 : 1;

  // Plan north is world −Z, so the gradient's y component flips with it.
  return [(-gradientX / length) * sign, (1 / length) * sign, (gradientY / length) * sign];
}

/** The band closing the roof's edge: from the soffit up to the covering. */
function appendFascia(
  builder: MeshBuilder,
  ring: Ring,
  height: (point: Vector2) => Meters,
  thicknessMeters: Meters
): void {
  if (ring.length < MIN_RING_VERTEX_COUNT) {
    return;
  }

  for (let index = 0; index < ring.length; index += 1) {
    const from = ring[index];
    const to = ring[(index + 1) % ring.length];
    const edgeX = to.x - from.x;
    const edgeY = to.y - from.y;
    const length = Math.hypot(edgeX, edgeY);

    if (length < MIN_EDGE_LENGTH_METERS) {
      continue;
    }

    // Outward normal of a counter-clockwise ring, in world axes.
    const normal: WorldPoint = [edgeY / length, 0, edgeX / length];
    const firstVertex = countVertices(builder);

    appendVertex(builder, planToWorld(from, height(from) - thicknessMeters), normal);
    appendVertex(builder, planToWorld(to, height(to) - thicknessMeters), normal);
    appendVertex(builder, planToWorld(to, height(to)), normal);
    appendVertex(builder, planToWorld(from, height(from)), normal);

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
 * The wall triangles a gable or a shed leaves above the storey below: over the
 * outline itself the roof stands higher than the eaves, and without these the
 * house is open to the sky at both ends.
 */
function appendGableWalls(
  builder: MeshBuilder,
  {
    faces,
    frame,
    footprint,
    eaveElevation,
    thicknessMeters,
  }: {
    readonly faces: readonly RoofFace[];
    readonly frame: RoofFrame;
    readonly footprint: MultiPolygon;
    readonly eaveElevation: Meters;
    readonly thicknessMeters: Meters;
  }
): void {
  const soffitAt = (point: Vector2): Meters =>
    eaveElevation + roofSurfaceHeight(faces, frame, point) - thicknessMeters;
  // The roof over an edge is the lower envelope of planes — PIECEWISE linear.
  // A gable's end edge peaks at its middle while both corners sit on the
  // eaves, so sampling only the corners once threw the whole triangle away
  // and left the house open at both ends. The edge is split wherever the
  // governing plane changes; within each piece the height is truly linear.
  const subdivideAt = (from: Vector2, to: Vector2): readonly Vector2[] => {
    const spans = faces.map(face => ({
      start: roofHeightAt(frame, face.plane, from),
      end: roofHeightAt(frame, face.plane, to),
    }));
    const crossings: number[] = [];

    for (let first = 0; first < spans.length; first += 1) {
      for (let second = first + 1; second < spans.length; second += 1) {
        const gapAtStart = spans[first].start - spans[second].start;
        const gapAtEnd = spans[first].end - spans[second].end;
        const denominator = gapAtStart - gapAtEnd;

        if (Math.abs(denominator) < CROSSING_EPSILON) {
          continue;
        }

        const t = gapAtStart / denominator;

        if (t > CROSSING_EPSILON && t < 1 - CROSSING_EPSILON) {
          crossings.push(t);
        }
      }
    }

    crossings.sort((left, right) => left - right);

    return crossings.map(t => ({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    }));
  };

  for (const polygon of footprint) {
    appendWallBand(builder, polygon.outer, eaveElevation, soffitAt, subdivideAt);

    for (const hole of polygon.holes) {
      appendWallBand(builder, hole, eaveElevation, soffitAt, subdivideAt);
    }
  }
}

/**
 * The roof over a point: the LOWEST of its planes. A roof is the lower envelope
 * of its slopes — each plane governs only the stretch where it is the lowest,
 * which is exactly what makes a gable a gable rather than two crossing planes.
 */
function roofSurfaceHeight(faces: readonly RoofFace[], frame: RoofFrame, point: Vector2): Meters {
  let lowest = Number.POSITIVE_INFINITY;

  for (const face of faces) {
    lowest = Math.min(lowest, roofHeightAt(frame, face.plane, point));
  }

  return Number.isFinite(lowest) ? lowest : 0;
}

function appendWallBand(
  builder: MeshBuilder,
  ring: Ring,
  eaveElevation: Meters,
  soffitAt: (point: Vector2) => Meters,
  subdivideAt: (from: Vector2, to: Vector2) => readonly Vector2[]
): void {
  if (ring.length < MIN_RING_VERTEX_COUNT) {
    return;
  }

  for (let index = 0; index < ring.length; index += 1) {
    const edgeFrom = ring[index];
    const edgeTo = ring[(index + 1) % ring.length];
    const chain = [edgeFrom, ...subdivideAt(edgeFrom, edgeTo), edgeTo];

    for (let piece = 0; piece < chain.length - 1; piece += 1) {
      appendWallPiece(builder, chain[piece], chain[piece + 1], eaveElevation, soffitAt);
    }
  }
}

function appendWallPiece(
  builder: MeshBuilder,
  from: Vector2,
  to: Vector2,
  eaveElevation: Meters,
  soffitAt: (point: Vector2) => Meters
): void {
  const edgeX = to.x - from.x;
  const edgeY = to.y - from.y;
  const length = Math.hypot(edgeX, edgeY);
  const fromTop = soffitAt(from);
  const toTop = soffitAt(to);

  if (length < MIN_EDGE_LENGTH_METERS || (fromTop <= eaveElevation && toTop <= eaveElevation)) {
    return;
  }

  const normal: WorldPoint = [edgeY / length, 0, edgeX / length];
  const firstVertex = countVertices(builder);

  appendVertex(builder, planToWorld(from, eaveElevation), normal);
  appendVertex(builder, planToWorld(to, eaveElevation), normal);
  appendVertex(builder, planToWorld(to, Math.max(toTop, eaveElevation)), normal);
  appendVertex(builder, planToWorld(from, Math.max(fromTop, eaveElevation)), normal);

  builder.indices.push(
    firstVertex,
    firstVertex + 1,
    firstVertex + 2,
    firstVertex,
    firstVertex + 2,
    firstVertex + 3
  );
}

function appendVertex(builder: MeshBuilder, position: WorldPoint, normal: WorldPoint): void {
  builder.positions.push(...position);
  builder.normals.push(...normal);
}

function countVertices(builder: MeshBuilder): number {
  return builder.positions.length / WORLD_COORDINATES_PER_VERTEX;
}
