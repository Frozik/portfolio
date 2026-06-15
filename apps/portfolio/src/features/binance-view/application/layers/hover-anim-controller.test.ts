import { describe, expect, test } from 'vitest';

import {
  HOVER_ENTER_DELAY_MS,
  HOVER_ENTER_MS,
  HOVER_LEAVE_MS,
  HOVER_SCALE_FACTOR,
} from '../../domain/trades-constants';
import type { UnixTimeMs } from '../../domain/types';

import {
  INITIAL_HOVER_STATE,
  startEnterTransition,
  startLeaveTransition,
  tickHoverAnim,
} from './hover-anim-controller';

const BUCKET_KEY_A = 100 as UnixTimeMs;
const BUCKET_KEY_B = 200 as UnixTimeMs;

const FRAME_MS = 16;

describe('startEnterTransition', () => {
  test('records the new bucket key and target = HOVER_SCALE_FACTOR', () => {
    const next = startEnterTransition(INITIAL_HOVER_STATE, BUCKET_KEY_A, 0);
    expect(next.activeBucketKey).toBe(BUCKET_KEY_A);
    expect(next.targetScale).toBe(HOVER_SCALE_FACTOR);
    expect(next.transitionDurMs).toBe(HOVER_ENTER_MS);
    expect(next.enterDelayUntilMs).toBe(HOVER_ENTER_DELAY_MS);
  });

  test('returns previous state when the bucket key matches an in-flight enter', () => {
    const first = startEnterTransition(INITIAL_HOVER_STATE, BUCKET_KEY_A, 0);
    const second = startEnterTransition(first, BUCKET_KEY_A, 50);
    expect(second).toBe(first);
  });
});

describe('tickHoverAnim — pre-enter delay', () => {
  test('inside the enter delay window: scale stays 1 and key is hidden', () => {
    const stateAfterEnter = startEnterTransition(INITIAL_HOVER_STATE, BUCKET_KEY_A, 0);
    const sample = tickHoverAnim(stateAfterEnter, 40);
    expect(sample.scale).toBe(1);
    expect(sample.activeBucketKey).toBeUndefined();
  });

  test('just past the enter delay: scale starts moving toward HOVER_SCALE_FACTOR', () => {
    const stateAfterEnter = startEnterTransition(INITIAL_HOVER_STATE, BUCKET_KEY_A, 0);
    // 1 ms past the delay: progress is 1/HOVER_ENTER_MS, so scale has only just lifted off 1.
    const sample = tickHoverAnim(stateAfterEnter, HOVER_ENTER_DELAY_MS + 1);
    expect(sample.activeBucketKey).toBe(BUCKET_KEY_A);
    expect(sample.scale).toBeGreaterThan(1);
    expect(sample.scale).toBeLessThanOrEqual(HOVER_SCALE_FACTOR);
  });
});

describe('tickHoverAnim — enter completion', () => {
  test('once the enter duration elapses, scale lands on HOVER_SCALE_FACTOR', () => {
    const stateAfterEnter = startEnterTransition(INITIAL_HOVER_STATE, BUCKET_KEY_A, 0);
    const sample = tickHoverAnim(stateAfterEnter, HOVER_ENTER_MS + HOVER_ENTER_DELAY_MS);
    expect(sample.activeBucketKey).toBe(BUCKET_KEY_A);
    expect(sample.scale).toBeCloseTo(HOVER_SCALE_FACTOR, 6);
  });
});

describe('startLeaveTransition', () => {
  test('mid-enter leave: startScale equals the current animated scale, not 1', () => {
    // Start the enter slightly past 0 so the enter transition begins
    // *after* an explicit pre-delay window.
    const enterStartMs = 0;
    const enterState = startEnterTransition(INITIAL_HOVER_STATE, BUCKET_KEY_A, enterStartMs);
    // Sample mid-animation: just past the delay so the enter has begun
    // but not fully landed (progress ≈ 0.017 → eased ≈ 0.05).
    const midNowMs = HOVER_ENTER_DELAY_MS + 2;
    const midScaleSample = tickHoverAnim(enterState, midNowMs);
    expect(midScaleSample.scale).toBeGreaterThan(1);
    expect(midScaleSample.scale).toBeLessThan(HOVER_SCALE_FACTOR);

    const leaveState = startLeaveTransition(enterState, midNowMs);
    expect(leaveState.startScale).toBeCloseTo(midScaleSample.scale, 6);
    expect(leaveState.targetScale).toBe(1);
    expect(leaveState.transitionDurMs).toBe(HOVER_LEAVE_MS);
    expect(leaveState.activeBucketKey).toBe(BUCKET_KEY_A);
    expect(leaveState.enterDelayUntilMs).toBe(0);
  });

  test('after leave completes, scale=1 and key is cleared', () => {
    const enterState = startEnterTransition(INITIAL_HOVER_STATE, BUCKET_KEY_A, 0);
    const leaveState = startLeaveTransition(enterState, HOVER_ENTER_DELAY_MS + HOVER_ENTER_MS);
    const completionMs = HOVER_ENTER_DELAY_MS + HOVER_ENTER_MS + HOVER_LEAVE_MS;
    const sample = tickHoverAnim(leaveState, completionMs);
    expect(sample.scale).toBe(1);
    expect(sample.activeBucketKey).toBeUndefined();
  });
});

describe('rapid toggle', () => {
  test('60 frames of alternating enter/leave never produce NaN or out-of-range scale', () => {
    let state = INITIAL_HOVER_STATE;
    let nowMs = 0;
    for (let frame = 0; frame < 60; frame++) {
      nowMs += FRAME_MS;
      state =
        frame % 2 === 0
          ? startEnterTransition(state, BUCKET_KEY_A, nowMs)
          : startLeaveTransition(state, nowMs);
      const sample = tickHoverAnim(state, nowMs);
      expect(Number.isFinite(sample.scale)).toBe(true);
      expect(sample.scale).toBeGreaterThanOrEqual(1);
      expect(sample.scale).toBeLessThanOrEqual(HOVER_SCALE_FACTOR);
    }
  });

  test('switching to a different bucket starts a fresh enter transition', () => {
    const enterA = startEnterTransition(INITIAL_HOVER_STATE, BUCKET_KEY_A, 0);
    const enterB = startEnterTransition(enterA, BUCKET_KEY_B, 50);
    expect(enterB.activeBucketKey).toBe(BUCKET_KEY_B);
    expect(enterB.targetScale).toBe(HOVER_SCALE_FACTOR);
    // Animation clock is anchored after the intent-delay so the full
    // enter duration plays once the delay elapses.
    expect(enterB.transitionStartMs).toBe(50 + HOVER_ENTER_DELAY_MS);
    expect(enterB.enterDelayUntilMs).toBe(50 + HOVER_ENTER_DELAY_MS);
  });
});
