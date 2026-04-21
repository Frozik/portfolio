import type { Milliseconds } from '@frozik/utils';
import { isNil } from 'lodash-es';

import { DEFAULT_BRAINSTORM_DURATION_MS, TIMER_WARNING_THRESHOLD_MS } from './constants';
import type { ITimerState } from './types';

export enum ETimerStatus {
  Idle = 'idle',
  Running = 'running',
  Paused = 'paused',
  Expired = 'expired',
}

/**
 * Compute remaining milliseconds in the timer given the current wall-clock
 * timestamp. Returns 0 when the timer has run past its duration.
 */
export function computeRemainingMs(timer: ITimerState, nowMs: Milliseconds): Milliseconds {
  if (isNil(timer.startedAt)) {
    return (timer.pausedRemainingMs ?? timer.durationMs) as Milliseconds;
  }

  const elapsed = nowMs - timer.startedAt;
  const remaining = timer.durationMs - elapsed;

  return Math.max(0, remaining) as Milliseconds;
}

export function getTimerStatus(timer: ITimerState, nowMs: Milliseconds): ETimerStatus {
  if (isNil(timer.startedAt)) {
    return isNil(timer.pausedRemainingMs) ? ETimerStatus.Idle : ETimerStatus.Paused;
  }

  return computeRemainingMs(timer, nowMs) === 0 ? ETimerStatus.Expired : ETimerStatus.Running;
}

export function isTimerInWarningZone(timer: ITimerState, nowMs: Milliseconds): boolean {
  const status = getTimerStatus(timer, nowMs);

  if (status !== ETimerStatus.Running) {
    return false;
  }

  const remaining = computeRemainingMs(timer, nowMs);

  return remaining > 0 && remaining <= TIMER_WARNING_THRESHOLD_MS;
}

export function createIdleTimer(
  durationMs: Milliseconds = DEFAULT_BRAINSTORM_DURATION_MS
): ITimerState {
  return {
    durationMs,
    startedAt: null,
    pausedRemainingMs: null,
  };
}

/**
 * Start or resume the timer.
 *
 * If resuming from pause, we shift `startedAt` into the past so that
 * `computeRemainingMs` returns exactly `pausedRemainingMs` at `nowMs`.
 */
export function startTimer(timer: ITimerState, nowMs: Milliseconds): ITimerState {
  const pausedRemaining = timer.pausedRemainingMs;
  const elapsedOffset = isNil(pausedRemaining) ? 0 : timer.durationMs - pausedRemaining;

  return {
    durationMs: timer.durationMs,
    startedAt: (nowMs - elapsedOffset) as Milliseconds,
    pausedRemainingMs: null,
  };
}

export function pauseTimer(timer: ITimerState, nowMs: Milliseconds): ITimerState {
  if (isNil(timer.startedAt)) {
    return timer;
  }

  const remaining = computeRemainingMs(timer, nowMs);

  return {
    durationMs: timer.durationMs,
    startedAt: null,
    pausedRemainingMs: remaining,
  };
}

/**
 * Add milliseconds to the duration. Works for running, paused, and idle timers.
 * When running, the effective remaining time increases by `extraMs` since
 * `startedAt` stays the same. When paused, we also bump pausedRemainingMs
 * so resuming reflects the extension.
 */
export function extendTimer(timer: ITimerState, extraMs: Milliseconds): ITimerState {
  const extendedDuration = (timer.durationMs + extraMs) as Milliseconds;
  const extendedPaused = isNil(timer.pausedRemainingMs)
    ? null
    : ((timer.pausedRemainingMs + extraMs) as Milliseconds);

  return {
    durationMs: extendedDuration,
    startedAt: timer.startedAt,
    pausedRemainingMs: extendedPaused,
  };
}

export function resetTimer(durationMs: Milliseconds): ITimerState {
  return createIdleTimer(durationMs);
}
