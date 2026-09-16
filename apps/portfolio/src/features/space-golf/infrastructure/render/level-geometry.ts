import type { Vector2 } from '@frozik/utils/math/vector2';

import { assertNever } from '@frozik/utils/assert/assertNever';

import { ROD_WIDTH_METERS } from '../../domain/constants';
import { cupCenter } from '../../domain/cup';
import type { Edge, Level } from '../../domain/level';
import { edgeOf } from '../../domain/level';
import { rodSeat } from '../../domain/rods';
import { rightNormal } from '../../domain/vector';
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
/** The steel plate a rod slides through: wider than the rod, sunk into the face and lipped out of it. */
const PLATE_WIDTH_METERS = ROD_WIDTH_METERS * 1.8;
const PLATE_DEPTH_METERS = 0.06;
const PLATE_LIP_METERS = 0.035;
/** The dark opening the rod passes through, a touch narrower than the rod so the rod seems to fill it. */
const PLATE_MOUTH_SHARE = 0.9;
const RIVET_RADIUS_METERS = 0.012;
const RIVET_INSET_METERS = 0.03;

/** Everything of a level that never moves, split by the pipeline that draws it. */
export interface LevelMeshes {
  /** The islands' bodies, painted with the pattern shader; the vertex colour is the lacquer under it. */
  readonly fill: MeshData;
  /** Flat-coloured on top: the rim along each outline — the cup's notch included — the flag and the rods' plates. */
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
  for (const rod of level.rods) {
    writePlate(decor, rod.base, rod.direction);
    writePlate(decor, rodSeat(rod), { x: -rod.direction.x, y: -rod.direction.y });
  }
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
    case 'rod':
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

/**
 * A steel plate on a face at `center`, `normal` pointing out of the face: a
 * bevelled collar, dark where it sinks into the wall and bright at the lip,
 * with a dark opening for the rod and a rivet either side of it.
 */
function writePlate(writer: MeshWriter, center: Vector2, normal: Vector2): void {
  const along = rightNormal(normal);
  const corner = (side: number, out: number): Vector2 =>
    offset(offset(center, along, side), normal, out);
  const half = PLATE_WIDTH_METERS / 2;
  writer.shadedTriangle(
    corner(-half, -PLATE_DEPTH_METERS),
    corner(half, -PLATE_DEPTH_METERS),
    corner(half, PLATE_LIP_METERS),
    [PALETTE.steelDark, PALETTE.steelDark, PALETTE.steelLight]
  );
  writer.shadedTriangle(
    corner(-half, -PLATE_DEPTH_METERS),
    corner(half, PLATE_LIP_METERS),
    corner(-half, PLATE_LIP_METERS),
    [PALETTE.steelDark, PALETTE.steelLight, PALETTE.steelLight]
  );
  const mouth = (ROD_WIDTH_METERS * PLATE_MOUTH_SHARE) / 2;
  writer.convexPolygon(
    [
      corner(-mouth, -PLATE_DEPTH_METERS),
      corner(mouth, -PLATE_DEPTH_METERS),
      corner(mouth, PLATE_LIP_METERS),
      corner(-mouth, PLATE_LIP_METERS),
    ],
    PALETTE.rivet
  );
  for (const side of [-1, 1]) {
    writer.circle(
      corner(side * (half - RIVET_INSET_METERS), (PLATE_LIP_METERS - PLATE_DEPTH_METERS) / 2),
      RIVET_RADIUS_METERS,
      PALETTE.rivet
    );
  }
}

function offset(point: Vector2, direction: Vector2, by: number): Vector2 {
  return { x: point.x + direction.x * by, y: point.y + direction.y * by };
}
