import type { Vector2 } from '@frozik/utils/math/vector2';

import { assertNever } from '@frozik/utils/assert/assertNever';

import { cupCenter } from '../../domain/cup';
import type { Edge, Level } from '../../domain/level';
import { edgeOf } from '../../domain/level';
import { FramedMeshWriter } from './framed-mesh-writer';
import type { MeshData } from './mesh-writer';
import { MeshWriter } from './mesh-writer';
import { PALETTE } from './palette';
import { writeSurfaceBand } from './surface-mesh-writer';

const RIM_WIDTH_METERS = 0.07;
/** A surface band reaches this far into the block from the face line. */
const SURFACE_WIDTH_METERS = 0.16;
/** And this far out of it — room for the goo's drips; the membrane paints nothing out there. */
const SURFACE_OUTSET_METERS = 0.07;
/** From the bottom of the notch, so about half of it shows above the face. */
const FLAG_POLE_HEIGHT_METERS = 0.75;
const FLAG_POLE_WIDTH_METERS = 0.03;
const FLAG_WIDTH_METERS = 0.22;
const FLAG_HEIGHT_METERS = 0.14;

/** Everything of a level that never moves, split by the pipeline that draws it. */
export interface LevelMeshes {
  /** The islands' bodies, painted with the pattern shader; the vertex colour is the lacquer under it. */
  readonly fill: MeshData;
  /** Flat-coloured on top: the rim along each outline — the cup's notch included — and the flag. */
  readonly decor: MeshData;
  /** The elastic and viscous bands, painted by the surface shader in their own frames, over the rim. */
  readonly surfaces: MeshData;
}

export function buildLevelMeshes(level: Level): LevelMeshes {
  const fill = new MeshWriter();
  const decor = new MeshWriter();
  const surfaces = new FramedMeshWriter();
  for (const wall of level.walls) {
    fill.polygon(wall.vertices, PALETTE.lacquer);
    decor.border(wall.vertices, RIM_WIDTH_METERS, PALETTE.rim);
    for (const edge of wall.edges) {
      writeSurface(surfaces, edge);
    }
  }
  writeFlag(decor, level);
  return { fill: fill.finish(), decor: decor.finish(), surfaces: surfaces.finish() };
}

function writeSurface(writer: FramedMeshWriter, edge: Edge): void {
  switch (edge.kind) {
    case 'bounce':
    case 'sticky':
      writeSurfaceBand(writer, edge, edge.kind, SURFACE_WIDTH_METERS, SURFACE_OUTSET_METERS);
      return;
    case 'floor':
    case 'deflector':
    case 'cup':
    case 'floater':
      return;
    default:
      assertNever(edge.kind);
  }
}

/** The pole stands on the bottom of the notch and rises out of it past the face. */
function writeFlag(writer: MeshWriter, level: Level): void {
  const edge = edgeOf(level, level.cup);
  const poleBase = offset(cupCenter(level), edge.normal, -level.cup.radius);
  const poleTop = offset(poleBase, edge.normal, FLAG_POLE_HEIGHT_METERS);
  writer.segment(poleBase, poleTop, FLAG_POLE_WIDTH_METERS, PALETTE.flag);
  const flagRoot = offset(poleBase, edge.normal, FLAG_POLE_HEIGHT_METERS - FLAG_HEIGHT_METERS);
  writer.triangle(
    poleTop,
    offset(poleTop, edge.direction, FLAG_WIDTH_METERS),
    offset(flagRoot, edge.direction, FLAG_WIDTH_METERS / 2),
    PALETTE.flag
  );
  writer.triangle(
    poleTop,
    offset(flagRoot, edge.direction, FLAG_WIDTH_METERS / 2),
    flagRoot,
    PALETTE.flag
  );
}

function offset(point: Vector2, direction: Vector2, by: number): Vector2 {
  return { x: point.x + direction.x * by, y: point.y + direction.y * by };
}
