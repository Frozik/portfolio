import { isNil } from 'lodash-es';

import type { Vector2 } from '@frozik/utils/math/vector2';
import { AIM_RING_RADIUS_METERS, BALL_RADIUS_METERS } from '../../domain/constants';

import { writeBand } from './band-geometry';
import { writeBonus } from './bonus-geometry';
import type { MeshData } from './mesh-writer';
import { MeshWriter } from './mesh-writer';
import { PALETTE, withAlpha } from './palette';
import type { ParticleField } from './particles';
import type { SceneFrame } from './scene-frame';

const PREVIEW_DOT_RADIUS_METERS = 0.045;
/** The burst: a ring growing from the ball's size to this radius while fading. */
const BURST_RADIUS_METERS = 0.6;
const BURST_RING_WIDTH_METERS = 0.08;
const BURST_SECONDS = 0.45;
const AIM_RING_WIDTH_METERS = 0.02;
const QUAD_HALF = 0.5;
/** The trail tapers from this share of the ball's width at its tail to the full width at the ball, and fades the same way. */
const TRAIL_TAIL_WIDTH_SHARE = 0.2;
const TRAIL_HEAD_ALPHA = 190;
/** How the trail fades along its length: 1 is even, higher keeps the light near the ball. */
const TRAIL_FADE_POWER = 1.7;
const ALPHA_MAX = 255;

/** The drifting dust, the far background everything else is painted over. */
export function buildDustMesh(dust: ParticleField): MeshData {
  const writer = new MeshWriter();
  for (const particle of dust.particles) {
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

/**
 * The ball, the band being pulled, the aim ring, the dots and the burst —
 * drawn over the board. The band may be pulled while the ball still moves:
 * the ring and the dots then follow the ball in grey, and turn white the
 * moment it rests and the stroke can be played.
 */
export function buildOverlayMesh(scene: SceneFrame, timeSeconds: number): MeshData {
  const writer = new MeshWriter();
  const { bonus } = scene.ball;
  if (!isNil(bonus.at) && scene.ball.phase !== 'holed') {
    writeBonus(writer, { at: bonus.at, kind: bonus.kind }, timeSeconds);
  }
  const pending = scene.ball.phase === 'flying';
  const aimable = scene.ball.phase === 'aiming' || pending;
  if (scene.aimRing && aimable) {
    writer.ring(
      scene.ballPosition,
      AIM_RING_RADIUS_METERS - AIM_RING_WIDTH_METERS / 2,
      AIM_RING_RADIUS_METERS + AIM_RING_WIDTH_METERS / 2,
      pending ? PALETTE.aimRingPending : PALETTE.aimRing
    );
  }
  if (!isNil(scene.preview) && aimable) {
    for (const dot of scene.preview) {
      writer.circle(dot, PREVIEW_DOT_RADIUS_METERS, pending ? PALETTE.dotPending : PALETTE.dot);
    }
  }
  if (!isNil(scene.burst)) {
    const progress = Math.min(1, scene.burst.elapsedSeconds / BURST_SECONDS);
    const radius = BALL_RADIUS_METERS + (BURST_RADIUS_METERS - BALL_RADIUS_METERS) * progress;
    writer.ring(
      scene.burst.position,
      radius - BURST_RING_WIDTH_METERS / 2,
      radius + BURST_RING_WIDTH_METERS / 2,
      withAlpha(PALETTE.burst, ALPHA_MAX * (1 - progress))
    );
  } else if (scene.ball.phase !== 'holed') {
    writeTrail(writer, [...scene.trail, scene.ballPosition]);
    writer.circle(scene.ballPosition, BALL_RADIUS_METERS, PALETTE.ball);
  }
  // The band is what the hand is doing: it goes over everything, the ball included.
  if (!isNil(scene.band)) {
    writeBand(writer, scene.band, timeSeconds);
  }
  return writer.finish();
}

/**
 * A streak behind the flying ball along the path it really took: a ball a
 * few pixels across covers more than its own width per frame, and drawn as
 * a lone disc it strobes; the streak is the motion blur that joins the
 * frames. Tapered and faded towards the tail, so it reads as a wake and not
 * as a line.
 */
function writeTrail(writer: MeshWriter, path: readonly Vector2[]): void {
  const last = path.length - 1;
  writer.ribbon(path, index => ({
    halfWidth:
      BALL_RADIUS_METERS * (TRAIL_TAIL_WIDTH_SHARE + (1 - TRAIL_TAIL_WIDTH_SHARE) * (index / last)),
    color: withAlpha(PALETTE.ball, TRAIL_HEAD_ALPHA * (index / last) ** TRAIL_FADE_POWER),
  }));
}
