import type { Vector2 } from '@frozik/utils/math/vector2';

import { SPIKE_HEIGHT_METERS, SPIKE_WIDTH_METERS } from '../../domain/constants';
import type { Level, Segment } from '../../domain/level';
import { pointAlongEdge } from '../../domain/level';
import type { MeshData } from './mesh-writer';
import { MeshWriter } from './mesh-writer';
import { PALETTE } from './palette';

/** A retracted tooth leaves a socket this deep in the face, a conical hole narrowing inwards. */
const SOCKET_DEPTH_METERS = 0.08;
/** The lip of the socket, drawn along the face line. */
const SOCKET_LIP_METERS = 0.012;
/** The teeth reach into the rim so no seam shows where they leave the face. */
const ROOT_DEPTH_METERS = 0.04;
/** Where across the tooth the highlight runs: the light comes from the left of the face's direction. */
const HIGHLIGHT_SHARE = 0.38;

/** The spike rows in their current states: standing teeth, shaded as cones, or the sockets they sank into. */
export function buildSpikeMesh(level: Level, extended: readonly boolean[]): MeshData {
  const writer = new MeshWriter();
  level.spikes.forEach((row, index) => {
    const edge = row.base;
    for (let tooth = 0; tooth < row.teeth; tooth += 1) {
      const base = tooth * SPIKE_WIDTH_METERS;
      if (extended[index]) {
        writeTooth(writer, edge, base);
      } else {
        writeSocket(writer, edge, base);
      }
    }
  });
  return writer.finish();
}

function writeTooth(writer: MeshWriter, edge: Segment, base: number): void {
  const left = lift(edge, base, -ROOT_DEPTH_METERS);
  const right = lift(edge, base + SPIKE_WIDTH_METERS, -ROOT_DEPTH_METERS);
  const highlight = lift(edge, base + SPIKE_WIDTH_METERS * HIGHLIGHT_SHARE, -ROOT_DEPTH_METERS);
  const tip = lift(edge, base + SPIKE_WIDTH_METERS / 2, SPIKE_HEIGHT_METERS);
  writer.shadedTriangle(left, tip, highlight, [
    PALETTE.spikeShade,
    PALETTE.spikeLit,
    PALETTE.spikeLit,
  ]);
  writer.shadedTriangle(highlight, tip, right, [
    PALETTE.spikeLit,
    PALETTE.spikeLit,
    PALETTE.spikeDark,
  ]);
}

function writeSocket(writer: MeshWriter, edge: Segment, base: number): void {
  const left = lift(edge, base, 0);
  const right = lift(edge, base + SPIKE_WIDTH_METERS, 0);
  const bottom = lift(edge, base + SPIKE_WIDTH_METERS / 2, -SOCKET_DEPTH_METERS);
  writer.shadedTriangle(left, bottom, right, [
    PALETTE.socketMouth,
    PALETTE.socketDepth,
    PALETTE.socketMouth,
  ]);
  writer.segment(left, right, SOCKET_LIP_METERS, PALETTE.socketLip);
}

/** The point `along` the face, `by` metres out of it. */
function lift(edge: Segment, along: number, by: number): Vector2 {
  const point = pointAlongEdge(edge, along);
  return { x: point.x + edge.normal.x * by, y: point.y + edge.normal.y * by };
}
