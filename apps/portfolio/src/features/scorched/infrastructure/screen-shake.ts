import type { Vector2 } from '@frozik/utils/math/vector2';

import type { WorldEvent } from '../domain/types';
import type { IReducedMotionWatcher } from './reduced-motion';
import {
  HIT_STOP_SECONDS,
  MAX_SHAKE_AMPLITUDE_WU,
  MAX_SHAKE_IMPULSES,
  SHAKE_AMPLITUDE_PER_RADIUS_WU,
  SHAKE_DURATION_SECONDS,
  SHAKE_FREQUENCY_HZ,
  SHAKE_PHASE_PER_WU,
  SHAKE_VERTICAL_FRACTION,
} from './render-constants';

/** One blast's contribution to the camera offset, from the moment it went off. */
export interface ShakeImpulse {
  readonly startTimeSeconds: number;
  readonly amplitudeWu: number;
  readonly phaseRadians: number;
}

const NO_OFFSET: Vector2 = { x: 0, y: 0 };
const FULL = 1;
const TAU = Math.PI * 2;

export function createShakeImpulse(
  radiusWu: number,
  positionX: number,
  timeSeconds: number
): ShakeImpulse {
  return {
    startTimeSeconds: timeSeconds,
    amplitudeWu: Math.min(MAX_SHAKE_AMPLITUDE_WU, radiusWu * SHAKE_AMPLITUDE_PER_RADIUS_WU),
    phaseRadians: positionX * SHAKE_PHASE_PER_WU,
  };
}

/**
 * The envelope: a decaying oscillation, squared so the shake dies away rather than stopping dead.
 * Returns zero once the impulse has run its course, which is what lets the pruning below be a
 * plain filter rather than a schedule.
 */
export function computeImpulseOffset(impulse: ShakeImpulse, timeSeconds: number): Vector2 {
  const progress = (timeSeconds - impulse.startTimeSeconds) / SHAKE_DURATION_SECONDS;

  if (progress < 0 || progress >= FULL) {
    return NO_OFFSET;
  }

  const decay = (FULL - progress) ** 2;
  const angle = TAU * SHAKE_FREQUENCY_HZ * progress * SHAKE_DURATION_SECONDS + impulse.phaseRadians;
  const swing = impulse.amplitudeWu * decay;

  return { x: Math.cos(angle) * swing, y: Math.sin(angle) * swing * SHAKE_VERTICAL_FRACTION };
}

/** Two blasts shake the camera together; the sum is clamped so a barrage cannot tear the view. */
export function computeShakeOffset(
  impulses: readonly ShakeImpulse[],
  timeSeconds: number
): Vector2 {
  let offsetX = 0;
  let offsetY = 0;

  for (const impulse of impulses) {
    const offset = computeImpulseOffset(impulse, timeSeconds);

    offsetX += offset.x;
    offsetY += offset.y;
  }

  return {
    x: clampToMaxAmplitude(offsetX),
    y: clampToMaxAmplitude(offsetY),
  };
}

export function pruneShakeImpulses(
  impulses: readonly ShakeImpulse[],
  timeSeconds: number
): readonly ShakeImpulse[] {
  return impulses.filter(
    impulse => timeSeconds - impulse.startTimeSeconds < SHAKE_DURATION_SECONDS
  );
}

function clampToMaxAmplitude(value: number): number {
  return Math.max(-MAX_SHAKE_AMPLITUDE_WU, Math.min(MAX_SHAKE_AMPLITUDE_WU, value));
}

/**
 * [§13 "Feel"] The juice the renderer applies to the camera: a shake scaled to the blast that
 * caused it, and a few frames of hit-stop when a shell strikes a tank squarely.
 *
 * Both live here rather than in the domain — the simulation is deterministic and knows nothing
 * about how long a frame took. The shake is a camera offset folded into the view transform's
 * uniform; the hit-stop only withholds ticks from the fixed-timestep driver, so the world resumes
 * exactly where it paused. `prefers-reduced-motion` switches both off, live.
 */
export class ScreenShake {
  private impulses: readonly ShakeImpulse[] = [];
  private hitStopRemainingSeconds = 0;

  constructor(private readonly reducedMotion: IReducedMotionWatcher) {}

  /** True while the simulation must hold still; the renderer keeps drawing regardless. */
  get isHitStopped(): boolean {
    return this.hitStopRemainingSeconds > 0;
  }

  consume(events: readonly WorldEvent[], timeSeconds: number): void {
    if (this.reducedMotion.isReduced) {
      this.clear();

      return;
    }

    for (const event of events) {
      if (event.type === 'explosion') {
        this.impulses = [
          ...this.impulses,
          createShakeImpulse(event.radiusWu, event.position.x, timeSeconds),
        ].slice(-MAX_SHAKE_IMPULSES);
      }

      if (event.type === 'projectile-ended' && event.reason === 'tank') {
        this.hitStopRemainingSeconds = HIT_STOP_SECONDS;
      }
    }
  }

  /** Ages the hit-stop on the wall clock and drops the impulses that have finished. */
  advance(elapsedSeconds: number, timeSeconds: number): void {
    this.hitStopRemainingSeconds = Math.max(0, this.hitStopRemainingSeconds - elapsedSeconds);
    this.impulses = pruneShakeImpulses(this.impulses, timeSeconds);
  }

  getOffset(timeSeconds: number): Vector2 {
    return this.impulses.length === 0 ? NO_OFFSET : computeShakeOffset(this.impulses, timeSeconds);
  }

  clear(): void {
    this.impulses = [];
    this.hitStopRemainingSeconds = 0;
  }
}
