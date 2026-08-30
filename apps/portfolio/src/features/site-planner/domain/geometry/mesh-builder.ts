import { isNil } from 'lodash-es';

import type { ColoredMesh } from './lit-mesh';

/** A point of a template, in whatever frame the template is authored in. */
export type LocalPoint = readonly [number, number, number];

/** Interleaved r, g, b in the 0…1 range the shader works in. */
export type Rgb = readonly [number, number, number];

const COORDINATES_PER_VERTEX = 3;
/** A face this small has no reliable direction to take a normal from. */
const MIN_FACE_NORMAL_LENGTH = 1e-9;

/**
 * A coloured mesh under construction. Faces are flat-shaded: each triangle
 * carries its own geometric normal, which is what gives the low-polygon
 * templates their facets instead of smoothing them away.
 */
export interface MeshBuilder {
  readonly positions: number[];
  readonly normals: number[];
  readonly colors: number[];
  readonly indices: number[];
}

export function createMeshBuilder(): MeshBuilder {
  return { positions: [], normals: [], colors: [], indices: [] };
}

/**
 * One flat-shaded face. The normal is the face's own, taken from the winding —
 * counter-clockwise seen from outside — so the geometry alone decides which way
 * the surface looks and no face can be lit from behind by mistake. A face with
 * no area to take a direction from is dropped rather than given one.
 */
export function appendTriangle(
  builder: MeshBuilder,
  first: LocalPoint,
  second: LocalPoint,
  third: LocalPoint,
  color: Rgb
): void {
  const normal = computeFaceNormal(first, second, third);

  if (isNil(normal)) {
    return;
  }

  const firstIndex = builder.positions.length / COORDINATES_PER_VERTEX;

  for (const point of [first, second, third]) {
    builder.positions.push(point[0], point[1], point[2]);
    builder.normals.push(normal[0], normal[1], normal[2]);
    builder.colors.push(color[0], color[1], color[2]);
  }

  builder.indices.push(firstIndex, firstIndex + 1, firstIndex + 2);
}

export function appendQuad(
  builder: MeshBuilder,
  first: LocalPoint,
  second: LocalPoint,
  third: LocalPoint,
  fourth: LocalPoint,
  color: Rgb
): void {
  appendTriangle(builder, first, second, third, color);
  appendTriangle(builder, first, third, fourth, color);
}

/** An axis-aligned box, all six faces wound outward. */
export function appendBox(
  builder: MeshBuilder,
  {
    minCorner,
    maxCorner,
    color,
  }: {
    readonly minCorner: LocalPoint;
    readonly maxCorner: LocalPoint;
    readonly color: Rgb;
  }
): void {
  const [minX, minY, minZ] = minCorner;
  const [maxX, maxY, maxZ] = maxCorner;

  appendQuad(
    builder,
    [maxX, minY, maxZ],
    [maxX, minY, minZ],
    [maxX, maxY, minZ],
    [maxX, maxY, maxZ],
    color
  );
  appendQuad(
    builder,
    [minX, minY, minZ],
    [minX, minY, maxZ],
    [minX, maxY, maxZ],
    [minX, maxY, minZ],
    color
  );
  appendQuad(
    builder,
    [minX, minY, maxZ],
    [maxX, minY, maxZ],
    [maxX, maxY, maxZ],
    [minX, maxY, maxZ],
    color
  );
  appendQuad(
    builder,
    [maxX, minY, minZ],
    [minX, minY, minZ],
    [minX, maxY, minZ],
    [maxX, maxY, minZ],
    color
  );
  appendQuad(
    builder,
    [minX, maxY, minZ],
    [minX, maxY, maxZ],
    [maxX, maxY, maxZ],
    [maxX, maxY, minZ],
    color
  );
  appendQuad(
    builder,
    [minX, minY, maxZ],
    [minX, minY, minZ],
    [maxX, minY, minZ],
    [maxX, minY, maxZ],
    color
  );
}

export function finishColoredMesh(builder: MeshBuilder): ColoredMesh {
  return {
    positions: Float32Array.from(builder.positions),
    normals: Float32Array.from(builder.normals),
    colors: Float32Array.from(builder.colors),
    indices: Uint32Array.from(builder.indices),
  };
}

function computeFaceNormal(
  first: LocalPoint,
  second: LocalPoint,
  third: LocalPoint
): LocalPoint | undefined {
  const edgeX = [second[0] - first[0], second[1] - first[1], second[2] - first[2]];
  const edgeY = [third[0] - first[0], third[1] - first[1], third[2] - first[2]];
  const crossX = edgeX[1] * edgeY[2] - edgeX[2] * edgeY[1];
  const crossY = edgeX[2] * edgeY[0] - edgeX[0] * edgeY[2];
  const crossZ = edgeX[0] * edgeY[1] - edgeX[1] * edgeY[0];
  const length = Math.hypot(crossX, crossY, crossZ);

  return length < MIN_FACE_NORMAL_LENGTH
    ? undefined
    : [crossX / length, crossY / length, crossZ / length];
}
