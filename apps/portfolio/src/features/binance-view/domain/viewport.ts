import { clamp } from 'lodash-es';
import {
  DEFAULT_PRICE_MAX,
  DEFAULT_PRICE_MIN,
  FOLLOW_EPSILON_MS,
  FUTURE_PADDING_MS,
  PAN_INERTIA_DAMPING,
  PAN_INERTIA_MIN_VELOCITY_MS,
  PIXELS_PER_MILLISECOND,
  VIEW_LERP_SPEED,
  VIEW_SNAP_THRESHOLD_MS,
} from './constants';

import { lerp } from './math';
import type { IHeatmapViewport, UnixTimeMs } from './types';

export function createInitialViewport(nowMs: UnixTimeMs): IHeatmapViewport {
  return {
    viewTimeEndMs: nowMs,
    targetViewTimeEndMs: nowMs,
    panVelocityMsPerFrame: 0,
    priceMin: DEFAULT_PRICE_MIN,
    priceMax: DEFAULT_PRICE_MAX,
  };
}

/**
 * Duration (ms) visible inside the heatmap plot area.
 *
 * The parameter is the **plot** width — i.e. full canvas width minus
 * the right-hand Y-axis panel — not the raw canvas width. Using the
 * raw canvas width here would make the viewport clamp and the shader
 * disagree about where the right edge of data lives, producing
 * sub-second offsets between the cursor and the X-axis label.
 */
export function viewDurationMsForPlotWidth(plotWidthCssPx: number): number {
  return plotWidthCssPx / PIXELS_PER_MILLISECOND;
}

export function viewTimeStartMs(viewport: IHeatmapViewport, plotWidthCssPx: number): UnixTimeMs {
  return (viewport.viewTimeEndMs - viewDurationMsForPlotWidth(plotWidthCssPx)) as UnixTimeMs;
}

export interface IViewportClampInput {
  readonly plotWidthCssPx: number;
  readonly pageOpenTimeMs: UnixTimeMs;
  readonly oldestBlockStartMs: UnixTimeMs | undefined;
  readonly lastDisplaySnapshotTimeMs: UnixTimeMs | undefined;
}

/**
 * Clamp a candidate `targetViewTimeEndMs` to the current data boundaries.
 *
 * Left bound:  `max(pageOpenTimeMs, oldestBlockStart) + viewDuration`.
 * Right bound: `lastDisplaySnapshotTimeMs + FUTURE_PADDING_MS` (or the
 * raw target when no snapshots are available yet).
 *
 * When the visible window is wider than the available data (early in
 * the session, or when the canvas is very wide), the left bound ends
 * up greater than the right bound. Naively clamping to `[minEnd,
 * maxEnd]` in that case produces an oscillation between the two on
 * alternating frames — the symptom that looked like "viewport jitter".
 * We instead pin the target to the newest data (`maxEnd`) and accept
 * that the left portion of the canvas stays blank until enough history
 * accumulates; the constraint stops flipping.
 */
export function clampTargetEnd(targetEndMs: UnixTimeMs, input: IViewportClampInput): UnixTimeMs {
  const viewDurationMs = viewDurationMsForPlotWidth(input.plotWidthCssPx);
  const leftBoundForStart = Math.max(
    input.pageOpenTimeMs,
    input.oldestBlockStartMs ?? input.pageOpenTimeMs
  );
  const minEnd = leftBoundForStart + viewDurationMs;
  const maxEnd =
    input.lastDisplaySnapshotTimeMs !== undefined
      ? input.lastDisplaySnapshotTimeMs + FUTURE_PADDING_MS
      : targetEndMs;
  if (minEnd > maxEnd) {
    return maxEnd as UnixTimeMs;
  }
  return clamp(targetEndMs, minEnd, maxEnd) as UnixTimeMs;
}

export function isFollowing(
  viewport: IHeatmapViewport,
  lastDisplayMs: UnixTimeMs | undefined
): boolean {
  if (lastDisplayMs === undefined) {
    return true;
  }
  return lastDisplayMs - viewport.viewTimeEndMs < FOLLOW_EPSILON_MS;
}

/**
 * Advance the viewport one frame: apply pan inertia, lerp view toward
 * target with snap, leaving price axis to external auto-fit.
 */
export function stepViewport(params: {
  viewport: IHeatmapViewport;
  input: IViewportClampInput;
  isInteracting: boolean;
}): void {
  const { viewport, input, isInteracting } = params;

  if (!isInteracting && Math.abs(viewport.panVelocityMsPerFrame) > PAN_INERTIA_MIN_VELOCITY_MS) {
    viewport.targetViewTimeEndMs = clampTargetEnd(
      (viewport.targetViewTimeEndMs + viewport.panVelocityMsPerFrame) as UnixTimeMs,
      input
    );
    viewport.panVelocityMsPerFrame *= PAN_INERTIA_DAMPING;
  } else if (!isInteracting) {
    viewport.panVelocityMsPerFrame = 0;
  }

  const delta = viewport.targetViewTimeEndMs - viewport.viewTimeEndMs;
  if (Math.abs(delta) < VIEW_SNAP_THRESHOLD_MS) {
    viewport.viewTimeEndMs = viewport.targetViewTimeEndMs;
  } else {
    viewport.viewTimeEndMs = lerp(
      viewport.viewTimeEndMs,
      viewport.targetViewTimeEndMs,
      VIEW_LERP_SPEED
    ) as UnixTimeMs;
  }
}

/** Follow-mode: snap target right edge to the newest flushed snapshot. */
export function engageFollow(
  viewport: IHeatmapViewport,
  lastDisplayMs: UnixTimeMs,
  input: IViewportClampInput
): void {
  viewport.targetViewTimeEndMs = clampTargetEnd(
    (lastDisplayMs + FUTURE_PADDING_MS) as UnixTimeMs,
    input
  );
}
