import { type Vector2 } from '@frozik/utils/math/vector2';
import { BOARD_HEIGHT_METERS } from '../constants';
import type { Cup, SpikeRow, Wall } from '../level';
import { createWall } from '../walls';
import type { Cell, CellGrid } from './cell-grid';
import type { UnitFace } from './exposed-faces';
import { exposedUnitFaces } from './exposed-faces';
import type { Random } from './random';

const CUP_RADIUS_METERS = 0.2;
const HALF = 0.5;
const MIN_SPIKE_ROWS = 3;
const MAX_SPIKE_ROWS = 7;
/** No spikes this close to the cup along its edge, so the hole itself stays reachable. */
const CUP_CLEARANCE_METERS = 1.5;
/** A row keeps this much of its metre free at both ends, clear of the corner cuts. */
const SPIKE_ROW_INSET_METERS = 0.2;
/** Elastic faces — the recording's thick gold bars — per level. */
const MIN_BOUNCE_FACES = 0;
const MAX_BOUNCE_FACES = 2;

export interface PlacedFeatures {
  readonly cup: Cup;
  readonly spikes: readonly SpikeRow[];
  /** The walls with the elastic faces marked. */
  readonly walls: readonly Wall[];
  /** The empty cells in front of the cup and the spike rows, to be left clear by later features. */
  readonly occupied: readonly Cell[];
}

/**
 * The cup goes on an exposed horizontal or vertical face in the lower half
 * of the board — never an underside, which would need gravity to point up;
 * spike rows take other faces, away from the cup and from under the tee.
 */
export function placeFeatures(
  random: Random,
  grid: CellGrid,
  walls: readonly Wall[],
  teeCell: Cell
): PlacedFeatures {
  const faces = exposedUnitFaces(grid, walls);
  const cupCandidates = faces.filter(
    face =>
      face.normal.y >= 0 && face.center.y < BOARD_HEIGHT_METERS / 2 && !supportsTee(face, teeCell)
  );
  const cupFace = random.pick(cupCandidates.length > 0 ? cupCandidates : faces);
  const cup: Cup = {
    wall: cupFace.wall,
    edge: cupFace.edge,
    at: cupFace.at + HALF,
    radius: CUP_RADIUS_METERS,
  };

  const spikeCandidates = faces.filter(
    face => !supportsTee(face, teeCell) && !nearCup(face, cup) && face !== cupFace
  );
  const rowCount = Math.min(random.int(MIN_SPIKE_ROWS, MAX_SPIKE_ROWS), spikeCandidates.length);
  const chosen = new Set<UnitFace>();
  while (chosen.size < rowCount) {
    chosen.add(random.pick(spikeCandidates));
  }
  const bounceCandidates = spikeCandidates.filter(face => !chosen.has(face));
  const bounceCount = Math.min(
    random.int(MIN_BOUNCE_FACES, MAX_BOUNCE_FACES),
    bounceCandidates.length
  );
  const bounceFaces = new Set<UnitFace>();
  while (bounceFaces.size < bounceCount) {
    bounceFaces.add(random.pick(bounceCandidates));
  }
  const elasticWalls = walls.map((wall, wallIndex) => {
    const edges = new Set(
      [...bounceFaces].filter(face => face.wall === wallIndex).map(face => face.edge)
    );
    return edges.size === 0 ? wall : createWall(wall.vertices, edges);
  });
  const spikes = [...chosen].map(face => ({
    wall: face.wall,
    edge: face.edge,
    from: face.at + SPIKE_ROW_INSET_METERS,
    length: 1 - 2 * SPIKE_ROW_INSET_METERS,
    extendedOnOddStrokes: random.chance(HALF),
  }));
  const occupied = [cupFace, ...chosen].map(face => cellInFront(face.center, face.normal));
  return { cup, spikes, walls: elasticWalls, occupied };
}

function cellInFront(center: Vector2, normal: Vector2): Cell {
  return { x: Math.floor(center.x + normal.x * HALF), y: Math.floor(center.y + normal.y * HALF) };
}

/** The face the ball starts on: the top of the shelf under the tee cell. */
function supportsTee(face: UnitFace, teeCell: Cell): boolean {
  return (
    face.normal.y === 1 &&
    face.center.y === teeCell.y &&
    Math.abs(face.center.x - (teeCell.x + HALF)) < 1
  );
}

function nearCup(face: UnitFace, cup: Cup): boolean {
  return (
    face.wall === cup.wall &&
    face.edge === cup.edge &&
    Math.abs(face.at + HALF - cup.at) < CUP_CLEARANCE_METERS
  );
}
