import { isNil } from 'lodash-es';

import { AIM_RING_RADIUS_METERS, BALL_RADIUS_METERS } from '../../domain/constants';
import type { MeshData } from './mesh-writer';
import { MeshWriter } from './mesh-writer';
import { PALETTE } from './palette';
import type { ParticleField } from './particles';
import type { SceneFrame } from './scene-frame';

const PREVIEW_DOT_RADIUS_METERS = 0.045;
/** The burst: a ring growing from the ball's size to this radius while fading. */
const BURST_RADIUS_METERS = 0.6;
const BURST_RING_WIDTH_METERS = 0.08;
const BURST_SECONDS = 0.45;
const AIM_RING_WIDTH_METERS = 0.02;
const QUAD_HALF = 0.5;
const ALPHA_MAX = 255;

/** The drifting dust, the far background everything else is painted over. */
export function buildDustMesh(dust: ParticleField): MeshData {
  const writer = new MeshWriter();
  for (const particle of dust) {
    const { x, y } = particle.position;
    const r = particle.radius * 2 * QUAD_HALF;
    writer.convexPolygon(
      [
        { x: x - r, y: y - r },
        { x: x + r, y: y - r },
        { x: x + r, y: y + r },
        { x: x - r, y: y + r },
      ],
      PALETTE.star
    );
  }
  return writer.finish();
}

/** The ball, the aim ring, the dots and the burst — drawn over the board. */
export function buildOverlayMesh(scene: SceneFrame): MeshData {
  const writer = new MeshWriter();
  if (scene.aimRing && scene.ball.phase === 'aiming') {
    writer.ring(
      scene.ball.position,
      AIM_RING_RADIUS_METERS - AIM_RING_WIDTH_METERS / 2,
      AIM_RING_RADIUS_METERS + AIM_RING_WIDTH_METERS / 2,
      PALETTE.aimRing
    );
  }
  if (!isNil(scene.preview)) {
    for (const dot of scene.preview) {
      writer.circle(dot, PREVIEW_DOT_RADIUS_METERS, PALETTE.dot);
    }
  }
  if (!isNil(scene.burst)) {
    const progress = Math.min(1, scene.burst.elapsedSeconds / BURST_SECONDS);
    const radius = BALL_RADIUS_METERS + (BURST_RADIUS_METERS - BALL_RADIUS_METERS) * progress;
    const alpha = Math.round(ALPHA_MAX * (1 - progress));
    writer.ring(
      scene.burst.position,
      radius - BURST_RING_WIDTH_METERS / 2,
      radius + BURST_RING_WIDTH_METERS / 2,
      [PALETTE.burst[0], PALETTE.burst[1], PALETTE.burst[2], alpha]
    );
  } else if (scene.ball.phase !== 'holed') {
    writer.circle(scene.ball.position, BALL_RADIUS_METERS, PALETTE.ball);
  }
  return writer.finish();
}
