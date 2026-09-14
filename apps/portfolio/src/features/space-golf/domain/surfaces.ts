import type { Vector2 } from '@frozik/utils/math/vector2';

import type { EdgeRef, FaceKind, SurfaceKind, Wall } from './level';
import { pointAlongEdge } from './level';
import { createWall } from './walls';

/** A stretch of one axis-aligned face given a surface of its own, metres from the edge's first vertex. */
export interface Surface extends EdgeRef {
  readonly from: number;
  readonly length: number;
  readonly kind: SurfaceKind;
}

/**
 * The walls with each surface cut into its face: the edge is split in three
 * — the plain stretch before, the surface, the plain stretch after — by two
 * collinear vertices, so the sweep, the rim and the floor rule need no
 * special case. Several surfaces on one wall are applied from the last edge
 * backwards so earlier indices stay valid.
 */
export function applySurfaces(
  walls: readonly Wall[],
  surfaces: readonly Surface[]
): readonly Wall[] {
  return walls.map((wall, wallIndex) => {
    const own = surfaces
      .filter(surface => surface.wall === wallIndex)
      .sort((a, b) => b.edge - a.edge);
    return own.reduce(splitEdge, wall);
  });
}

function splitEdge(wall: Wall, surface: Surface): Wall {
  const edge = wall.edges[surface.edge];
  const start = pointAlongEdge(edge, surface.from);
  const end = pointAlongEdge(edge, surface.from + surface.length);
  const vertices: Vector2[] = [
    ...wall.vertices.slice(0, surface.edge + 1),
    start,
    end,
    ...wall.vertices.slice(surface.edge + 1),
  ];
  const kinds = new Map<number, FaceKind>();
  wall.edges.forEach((each, index) => {
    if (each.kind !== 'floor' && each.kind !== 'deflector') {
      kinds.set(index > surface.edge ? index + 2 : index, each.kind);
    }
  });
  kinds.set(surface.edge + 1, surface.kind);
  return createWall(vertices, kinds);
}
