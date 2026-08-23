import { describe, expect, it } from 'vitest';

import type { WorldEvent } from '../domain/types';
import type { IReducedMotionWatcher } from './reduced-motion';
import {
  HIT_STOP_SECONDS,
  MAX_SHAKE_AMPLITUDE_WU,
  MAX_SHAKE_IMPULSES,
  SHAKE_AMPLITUDE_PER_RADIUS_WU,
  SHAKE_DURATION_SECONDS,
} from './render-constants';
import {
  computeImpulseOffset,
  computeShakeOffset,
  createShakeImpulse,
  pruneShakeImpulses,
  ScreenShake,
} from './screen-shake';

const START_TIME_SECONDS = 10;
const SMALL_BLAST_RADIUS_WU = 10;
const HUGE_BLAST_RADIUS_WU = 400;
const IMPACT_X_WU = 100;
const FRAME_SECONDS = 1 / 60;

function createWatcherStub(isReduced: boolean): IReducedMotionWatcher {
  return { isReduced, dispose: () => {} };
}

function createExplosion(radiusWu: number): WorldEvent {
  return {
    type: 'explosion',
    position: { x: IMPACT_X_WU, y: 100 },
    radiusWu,
    weaponId: 'baby-missile',
  };
}

const DIRECT_HIT: WorldEvent = {
  type: 'projectile-ended',
  projectileId: 1,
  position: { x: IMPACT_X_WU, y: 100 },
  reason: 'tank',
};

function measurePeakAmplitude(radiusWu: number): number {
  const impulse = createShakeImpulse(radiusWu, IMPACT_X_WU, START_TIME_SECONDS);
  let peak = 0;

  for (let step = 0; step * FRAME_SECONDS < SHAKE_DURATION_SECONDS; step++) {
    const offset = computeImpulseOffset(impulse, START_TIME_SECONDS + step * FRAME_SECONDS);

    peak = Math.max(peak, Math.abs(offset.x), Math.abs(offset.y));
  }

  return peak;
}

describe('shake envelope', () => {
  it('scales the throw with the blast radius', () => {
    expect(createShakeImpulse(20, IMPACT_X_WU, START_TIME_SECONDS).amplitudeWu).toBeCloseTo(
      20 * SHAKE_AMPLITUDE_PER_RADIUS_WU
    );
    expect(measurePeakAmplitude(HUGE_BLAST_RADIUS_WU)).toBeGreaterThan(
      measurePeakAmplitude(SMALL_BLAST_RADIUS_WU)
    );
  });

  it('never lets even an absurd blast throw the camera past the cap', () => {
    expect(createShakeImpulse(HUGE_BLAST_RADIUS_WU, 0, 0).amplitudeWu).toBe(MAX_SHAKE_AMPLITUDE_WU);
    expect(measurePeakAmplitude(HUGE_BLAST_RADIUS_WU)).toBeLessThanOrEqual(MAX_SHAKE_AMPLITUDE_WU);
  });

  it('decays to nothing over the impulse duration', () => {
    const impulse = createShakeImpulse(HUGE_BLAST_RADIUS_WU, IMPACT_X_WU, START_TIME_SECONDS);
    const early = computeImpulseOffset(impulse, START_TIME_SECONDS + SHAKE_DURATION_SECONDS * 0.05);
    const late = computeImpulseOffset(impulse, START_TIME_SECONDS + SHAKE_DURATION_SECONDS * 0.95);

    expect(Math.hypot(early.x, early.y)).toBeGreaterThan(Math.hypot(late.x, late.y));
    expect(
      computeImpulseOffset(impulse, START_TIME_SECONDS + SHAKE_DURATION_SECONDS + FRAME_SECONDS)
    ).toEqual({ x: 0, y: 0 });
  });

  it('ignores an impulse that has not gone off yet', () => {
    const impulse = createShakeImpulse(HUGE_BLAST_RADIUS_WU, IMPACT_X_WU, START_TIME_SECONDS);

    expect(computeImpulseOffset(impulse, START_TIME_SECONDS - 1)).toEqual({ x: 0, y: 0 });
  });

  it('throws the camera further sideways than vertically', () => {
    const impulse = createShakeImpulse(HUGE_BLAST_RADIUS_WU, 0, START_TIME_SECONDS);
    let peakX = 0;
    let peakY = 0;

    for (let step = 0; step * FRAME_SECONDS < SHAKE_DURATION_SECONDS; step++) {
      const offset = computeImpulseOffset(impulse, START_TIME_SECONDS + step * FRAME_SECONDS);

      peakX = Math.max(peakX, Math.abs(offset.x));
      peakY = Math.max(peakY, Math.abs(offset.y));
    }

    expect(peakX).toBeGreaterThan(peakY);
  });

  it('clamps a barrage of simultaneous blasts to the same cap', () => {
    const barrage = Array.from({ length: MAX_SHAKE_IMPULSES }, () =>
      createShakeImpulse(HUGE_BLAST_RADIUS_WU, 0, START_TIME_SECONDS)
    );
    const offset = computeShakeOffset(barrage, START_TIME_SECONDS + FRAME_SECONDS);

    expect(Math.abs(offset.x)).toBeLessThanOrEqual(MAX_SHAKE_AMPLITUDE_WU);
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(MAX_SHAKE_AMPLITUDE_WU);
  });

  it('drops impulses that have finished and keeps the ones still ringing', () => {
    const impulses = [
      createShakeImpulse(SMALL_BLAST_RADIUS_WU, 0, START_TIME_SECONDS),
      createShakeImpulse(SMALL_BLAST_RADIUS_WU, 0, START_TIME_SECONDS + SHAKE_DURATION_SECONDS),
    ];

    expect(
      pruneShakeImpulses(impulses, START_TIME_SECONDS + SHAKE_DURATION_SECONDS + FRAME_SECONDS)
    ).toHaveLength(1);
  });
});

describe('ScreenShake', () => {
  it('shakes on an explosion and settles once the impulse has run out', () => {
    const shake = new ScreenShake(createWatcherStub(false));

    shake.consume([createExplosion(HUGE_BLAST_RADIUS_WU)], START_TIME_SECONDS);

    const offset = shake.getOffset(START_TIME_SECONDS + FRAME_SECONDS);

    expect(Math.hypot(offset.x, offset.y)).toBeGreaterThan(0);

    const settledTimeSeconds = START_TIME_SECONDS + SHAKE_DURATION_SECONDS + FRAME_SECONDS;

    shake.advance(SHAKE_DURATION_SECONDS + FRAME_SECONDS, settledTimeSeconds);

    expect(shake.getOffset(settledTimeSeconds)).toEqual({ x: 0, y: 0 });
  });

  it('stops the world for a few frames on a direct tank hit', () => {
    const shake = new ScreenShake(createWatcherStub(false));

    expect(shake.isHitStopped).toBe(false);

    shake.consume([DIRECT_HIT], START_TIME_SECONDS);

    expect(shake.isHitStopped).toBe(true);

    shake.advance(HIT_STOP_SECONDS, START_TIME_SECONDS + HIT_STOP_SECONDS);

    expect(shake.isHitStopped).toBe(false);
  });

  it('leaves a shot that only hit the dirt alone', () => {
    const shake = new ScreenShake(createWatcherStub(false));

    shake.consume([{ ...DIRECT_HIT, reason: 'terrain' }], START_TIME_SECONDS);

    expect(shake.isHitStopped).toBe(false);
  });

  it('keeps the camera perfectly still when the player asked for reduced motion', () => {
    const shake = new ScreenShake(createWatcherStub(true));

    shake.consume([createExplosion(HUGE_BLAST_RADIUS_WU), DIRECT_HIT], START_TIME_SECONDS);

    expect(shake.getOffset(START_TIME_SECONDS + FRAME_SECONDS)).toEqual({ x: 0, y: 0 });
    expect(shake.isHitStopped).toBe(false);
  });

  it('drops everything still ringing when the round is replaced', () => {
    const shake = new ScreenShake(createWatcherStub(false));

    shake.consume([createExplosion(HUGE_BLAST_RADIUS_WU), DIRECT_HIT], START_TIME_SECONDS);
    shake.clear();

    expect(shake.getOffset(START_TIME_SECONDS + FRAME_SECONDS)).toEqual({ x: 0, y: 0 });
    expect(shake.isHitStopped).toBe(false);
  });
});
