import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { densifyRing } from '../geometry/densify-ring';
import type { ColoredMesh, LitMesh } from '../geometry/lit-mesh';
import { EMPTY_COLORED_MESH, EMPTY_LIT_MESH, mergeLitMeshes } from '../geometry/lit-mesh';
import type { MultiPolygon } from '../geometry/polygon-types';
import { triangulateMultiPolygon } from '../geometry/triangulate-polygon';
import type { Meters } from '../units';
import type { WorldPoint } from '../view/world-frame';
import { planToWorld } from '../view/world-frame';
import type { Heightfield } from './heightfield';
import { sampleHeight } from './heightfield';

const COORDINATES_PER_PLAN_VERTEX = 2;
const WORLD_COORDINATES_PER_VERTEX = 3;

/**
 * Lays flat plan geometry — the ribbon of a path — onto the sampled terrain.
 *
 * Two things make it read as paving rather than as a sheet laid over the garden.
 * Every ring is first split down to the cell size, because a straight edge lifted
 * only at its two ends cuts through every rise between them; and each vertex is
 * lifted by `elevationOffset` above the ground, which is what keeps the ribbon
 * out of the depth fight with the terrain drawn underneath it.
 *
 * The normals are the terrain's own, taken by central differences, so a path
 * running across a slope catches the light exactly as the ground beside it does.
 */
export function drapePolygons({
  polygons,
  field,
  elevationOffset,
}: {
  readonly polygons: MultiPolygon;
  readonly field: Heightfield;
  readonly elevationOffset: Meters;
}): LitMesh {
  const mesh = triangulateMultiPolygon(densifyPolygons(polygons, field.cellSizeMeters));

  if (mesh.indices.length === 0) {
    return EMPTY_LIT_MESH;
  }

  const vertexCount = mesh.positions.length / COORDINATES_PER_PLAN_VERTEX;
  const positions = new Float32Array(vertexCount * WORLD_COORDINATES_PER_VERTEX);
  const normals = new Float32Array(vertexCount * WORLD_COORDINATES_PER_VERTEX);

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const point: Vector2 = {
      x: mesh.positions[vertex * COORDINATES_PER_PLAN_VERTEX],
      y: mesh.positions[vertex * COORDINATES_PER_PLAN_VERTEX + 1],
    };
    const offset = vertex * WORLD_COORDINATES_PER_VERTEX;

    positions.set(
      planToWorld(point, sampleHeight(field, point.x, point.y) + elevationOffset),
      offset
    );
    normals.set(computeTerrainNormal(field, point), offset);
  }

  return { positions, normals, indices: mesh.indices };
}

/**
 * The 3D paving hues, one per surface — the same figures the shader holds as
 * ASPHALT_COLOR / DIRT_COLOR (`objects.wgsl`) and the plan derives its fills
 * from, so a blended vertex fades between exactly the colours beside it.
 */
export const PATH_SURFACE_DRAPE_COLORS: Readonly<
  Record<'asphalt' | 'dirt', readonly [number, number, number]>
> = {
  asphalt: [0.4627, 0.5059, 0.6039],
  dirt: [0.6078, 0.4784, 0.298],
};

const COLOR_COMPONENTS_PER_VERTEX = 3;

/**
 * Drapes the seam-blend strips and bakes their gradients into vertex colours:
 * each vertex takes the mix of the two paving hues at its projection onto the
 * strip's axis, so the fade survives into 3D with no new shader state — the
 * mesh arrives painted, like a tree does.
 */
export function drapeBlendStrips({
  strips,
  field,
  elevationOffset,
}: {
  readonly strips: readonly {
    readonly polygons: MultiPolygon;
    readonly fromColor: readonly [number, number, number];
    readonly toColor: readonly [number, number, number];
    readonly start: Vector2;
    readonly end: Vector2;
  }[];
  readonly field: Heightfield;
  readonly elevationOffset: Meters;
}): ColoredMesh {
  const draped = strips.map(strip => {
    const mesh = drapePolygons({ polygons: strip.polygons, field, elevationOffset });
    const vertexCount = mesh.positions.length / WORLD_COORDINATES_PER_VERTEX;
    const colors = new Float32Array(vertexCount * COLOR_COMPONENTS_PER_VERTEX);
    const axisX = strip.end.x - strip.start.x;
    const axisY = strip.end.y - strip.start.y;
    const axisLengthSquared = axisX * axisX + axisY * axisY;

    for (let vertex = 0; vertex < vertexCount; vertex += 1) {
      const worldOffset = vertex * WORLD_COORDINATES_PER_VERTEX;
      // planToWorld maps plan (x, y) to world (x, elevation, -y) — undone here.
      const planX = mesh.positions[worldOffset];
      const planY = -mesh.positions[worldOffset + 2];
      const along =
        axisLengthSquared === 0
          ? 0
          : ((planX - strip.start.x) * axisX + (planY - strip.start.y) * axisY) / axisLengthSquared;
      const mix = Math.min(Math.max(along, 0), 1);

      for (let component = 0; component < COLOR_COMPONENTS_PER_VERTEX; component += 1) {
        colors[vertex * COLOR_COMPONENTS_PER_VERTEX + component] =
          strip.fromColor[component] +
          (strip.toColor[component] - strip.fromColor[component]) * mix;
      }
    }

    return { ...mesh, colors };
  });

  return mergeColoredMeshes(draped);
}

function mergeColoredMeshes(meshes: readonly ColoredMesh[]): ColoredMesh {
  const merged = mergeLitMeshes(meshes);

  if (isNil(merged)) {
    return EMPTY_COLORED_MESH;
  }

  const colorCount = meshes.reduce((sum, mesh) => sum + mesh.colors.length, 0);
  const colors = new Float32Array(colorCount);
  let offset = 0;

  for (const mesh of meshes) {
    colors.set(mesh.colors, offset);
    offset += mesh.colors.length;
  }

  return { ...merged, colors };
}

function densifyPolygons(polygons: MultiPolygon, maxSegmentMeters: Meters): MultiPolygon {
  return polygons.map(polygon => ({
    outer: densifyRing(polygon.outer, maxSegmentMeters),
    holes: polygon.holes.map(hole => densifyRing(hole, maxSegmentMeters)),
  }));
}

/**
 * Terrain normal at a plan point, by central differences over one cell — the
 * very reconstruction the ground's own shader runs, so the two agree.
 */
function computeTerrainNormal(field: Heightfield, point: Vector2): WorldPoint {
  const step = field.cellSizeMeters;
  const slopeEast =
    (sampleHeight(field, point.x + step, point.y) - sampleHeight(field, point.x - step, point.y)) /
    (2 * step);
  const slopeNorth =
    (sampleHeight(field, point.x, point.y + step) - sampleHeight(field, point.x, point.y - step)) /
    (2 * step);
  const length = Math.hypot(slopeEast, slopeNorth, 1);
  const [x, y, z] = planToWorld({ x: -slopeEast / length, y: -slopeNorth / length }, 1 / length);

  return [x, y, z];
}
