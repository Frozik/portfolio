import type { Vector2 } from '@frozik/utils/math/vector2';

import { SPIKE_HEIGHT_METERS } from '../../domain/constants';
import { cupCenter } from '../../domain/cup';
import type { Edge, Level, SpikeRow, Wall } from '../../domain/level';
import { edgeOf, pointAlongEdge } from '../../domain/level';
import { isExtended } from '../../domain/spikes';
import { containsPoint } from '../../domain/walls';
import type { MeshData } from './mesh-writer';
import { MeshWriter } from './mesh-writer';
import { PALETTE } from './palette';

const RIM_WIDTH_METERS = 0.07;
/** Elastic faces read as the original's thick gold bars. */
const BOUNCE_RIM_WIDTH_METERS = 0.22;
/** How far outside an edge to look for another wall before calling the edge a seam. */
const SEAM_PROBE_METERS = 0.01;
/** Resolution at which an edge is checked for seams. */
const RIM_SAMPLE_METERS = 0.1;
const SPIKE_PITCH_METERS = 0.25;
const SPIKE_BASE_METERS = 0.2;
const NUB_HEIGHT_METERS = 0.05;
const NUB_WIDTH_METERS = 0.14;
const FLAG_POLE_HEIGHT_METERS = 0.9;
const FLAG_POLE_WIDTH_METERS = 0.04;
const FLAG_WIDTH_METERS = 0.32;
const FLAG_HEIGHT_METERS = 0.2;

/** Everything of a level that never moves, split by what changes with the stroke parity. */
export interface LevelMeshes {
  readonly stage: MeshData;
  /** Spike rows as they stand during an odd stroke. */
  readonly spikesOnOddStroke: MeshData;
  readonly spikesOnEvenStroke: MeshData;
}

export function buildLevelMeshes(level: Level): LevelMeshes {
  const stage = new MeshWriter();
  for (const wall of level.walls) {
    stage.polygon(wall.vertices, isElasticBar(wall) ? PALETTE.rim : PALETTE.block);
  }
  for (const wall of level.walls) {
    if (isElasticBar(wall)) {
      continue;
    }
    for (const edge of wall.edges) {
      const width = edge.kind === 'bounce' ? BOUNCE_RIM_WIDTH_METERS : RIM_WIDTH_METERS;
      for (const run of exposedRuns(level, wall, edge)) {
        stage.segment(run.from, run.to, width, PALETTE.rim);
      }
    }
  }
  writeCupAndFlag(stage, level);
  return {
    stage: stage.finish(),
    spikesOnOddStroke: writeSpikes(level, 1),
    spikesOnEvenStroke: writeSpikes(level, 2),
  };
}

/** A wall elastic on every straight face — the thin bright bars — is drawn solid in the rim colour. */
function isElasticBar(wall: Wall): boolean {
  return wall.edges.every(edge => edge.kind === 'bounce' || edge.kind === 'deflector');
}

function writeCupAndFlag(writer: MeshWriter, level: Level): void {
  const edge = edgeOf(level, level.cup);
  const poleBase = cupCenter(level);
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

function writeSpikes(level: Level, stroke: number): MeshData {
  const writer = new MeshWriter();
  for (const row of level.spikes) {
    writeSpikeRow(writer, level, row, isExtended(row, stroke));
  }
  return writer.finish();
}

function writeSpikeRow(writer: MeshWriter, level: Level, row: SpikeRow, extended: boolean): void {
  const edge = edgeOf(level, row);
  const count = Math.max(1, Math.round(row.length / SPIKE_PITCH_METERS));
  for (let index = 0; index < count; index += 1) {
    const base = pointAlongEdge(edge, row.from + (index + 1 / 2) * (row.length / count));
    if (extended) {
      writer.triangle(
        offset(base, edge.direction, -SPIKE_BASE_METERS / 2),
        offset(base, edge.direction, SPIKE_BASE_METERS / 2),
        offset(base, edge.normal, SPIKE_HEIGHT_METERS),
        PALETTE.spike
      );
    } else {
      const left = offset(base, edge.direction, -NUB_WIDTH_METERS / 2);
      const right = offset(base, edge.direction, NUB_WIDTH_METERS / 2);
      writer.convexPolygon(
        [
          left,
          right,
          offset(right, edge.normal, NUB_HEIGHT_METERS),
          offset(left, edge.normal, NUB_HEIGHT_METERS),
        ],
        PALETTE.spikeRetracted
      );
    }
  }
}

function offset(point: Vector2, direction: Vector2, by: number): Vector2 {
  return { x: point.x + direction.x * by, y: point.y + direction.y * by };
}

/**
 * The stretches of an edge with open space in front of them. An edge shared
 * with a neighbouring block, or the short legs of a fillet against the
 * blocks it joins, is a seam inside the solid and gets no rim; an edge
 * covered only in part keeps its rim where it is exposed.
 */
function exposedRuns(
  level: Level,
  owner: Wall,
  edge: Edge
): readonly { from: Vector2; to: Vector2 }[] {
  const steps = Math.max(1, Math.ceil(edge.length / RIM_SAMPLE_METERS));
  const runs: { from: Vector2; to: Vector2 }[] = [];
  let runStart: number | undefined;
  for (let index = 0; index <= steps; index += 1) {
    const exposed =
      index < steps &&
      !isCovered(
        level,
        owner,
        offset(
          pointAlongEdge(edge, (index + 1 / 2) * (edge.length / steps)),
          edge.normal,
          SEAM_PROBE_METERS
        )
      );
    if (exposed && runStart === undefined) {
      runStart = index;
    }
    if (!exposed && runStart !== undefined) {
      runs.push({
        from: pointAlongEdge(edge, runStart * (edge.length / steps)),
        to: pointAlongEdge(edge, index * (edge.length / steps)),
      });
      runStart = undefined;
    }
  }
  return runs;
}

function isCovered(level: Level, owner: Wall, point: Vector2): boolean {
  return level.walls.some(wall => wall !== owner && containsPoint(wall, point));
}
