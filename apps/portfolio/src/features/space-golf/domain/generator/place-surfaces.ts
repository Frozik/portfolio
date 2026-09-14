import type { Vector2 } from '@frozik/utils/math/vector2';

import { CELL_METERS } from '../constants';
import type { Edge, SurfaceKind, Wall } from '../level';
import { pointAlongEdge } from '../level';
import type { Surface } from '../surfaces';
import type { CellGrid } from './cell-grid';
import { isBlock } from './cell-grid';
import type { Random } from './random';

/** A face gets a surface only when it is long enough to keep plain floor on both sides of it. */
const MIN_FACE_METERS = 1.5;
const MIN_SURFACE_METERS = 0.5;
const MAX_SURFACE_METERS = 2;
/** Plain floor kept at both ends of the face, clear of the corner cuts. */
const END_MARGIN_METERS = 0.2;
/** Solid behind the face, in cells, for the surface to read as part of a massive block. */
const MIN_DEPTH_CELLS = 2;
const MIN_SURFACES = 1;
const MAX_SURFACES = 3;
const KINDS: readonly SurfaceKind[] = ['bounce', 'sticky'];
/** Where behind the face the depth probe starts: just inside the solid. */
const PROBE_INSET_METERS = 0.05;

/**
 * Surfaces for a level: on long axis-aligned faces with plenty of solid
 * behind them — a metre and more — a stretch of half a metre to two is made
 * elastic or viscous, with plain floor left at both ends. At most one per
 * face, one to three per level.
 */
export function placeSurfaces(
  random: Random,
  walls: readonly Wall[],
  grid: CellGrid
): readonly Surface[] {
  const candidates = walls.flatMap((wall, wallIndex) =>
    wall.edges
      .map((face, edgeIndex) => ({ wall: wallIndex, edge: edgeIndex, face }))
      .filter(
        candidate =>
          candidate.face.kind === 'floor' &&
          candidate.face.length >= MIN_FACE_METERS &&
          isDeep(candidate.face, grid)
      )
  );
  const wanted = Math.min(random.int(MIN_SURFACES, MAX_SURFACES), candidates.length);
  const surfaces: Surface[] = [];
  while (surfaces.length < wanted) {
    const index = random.int(0, candidates.length - 1);
    const [chosen] = candidates.splice(index, 1);
    const room = chosen.face.length - 2 * END_MARGIN_METERS;
    const length =
      MIN_SURFACE_METERS +
      random.next() * (Math.min(MAX_SURFACE_METERS, room) - MIN_SURFACE_METERS);
    const from = END_MARGIN_METERS + random.next() * (room - length);
    surfaces.push({ wall: chosen.wall, edge: chosen.edge, from, length, kind: random.pick(KINDS) });
  }
  return surfaces;
}

/** Whether the solid runs on behind the middle of the face for the minimum depth. */
function isDeep(face: Edge, grid: CellGrid): boolean {
  const middle = pointAlongEdge(face, face.length / 2);
  for (let depth = 0; depth < MIN_DEPTH_CELLS; depth += 1) {
    const probe: Vector2 = {
      x: middle.x - face.normal.x * (PROBE_INSET_METERS + depth * CELL_METERS),
      y: middle.y - face.normal.y * (PROBE_INSET_METERS + depth * CELL_METERS),
    };
    if (!isBlock(grid, Math.floor(probe.x / CELL_METERS), Math.floor(probe.y / CELL_METERS))) {
      return false;
    }
  }
  return true;
}
