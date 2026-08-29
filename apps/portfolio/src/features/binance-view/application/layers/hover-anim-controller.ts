import {
  HOVER_ENTER_DELAY_MS,
  HOVER_ENTER_MS,
  HOVER_LEAVE_MS,
  HOVER_SCALE_FACTOR,
} from '../../domain/trades-constants';
import type { UnixTimeMs } from '../../domain/types';

/**
 * Pure state-machine for the trade-bucket hover animation.
 *
 * Lives next to the trades layer renderer rather than in MobX: the
 * renderer drives this from `requestAnimationFrame` directly, so
 * per-frame mutations don't pay any observable ceremony.
 * The only MobX boundary is `hoveredBucketKey` on the trades store —
 * the renderer reads it once per frame and feeds transitions through
 * {@link startEnterTransition} / {@link startLeaveTransition}.
 *
 * Behaviour summary:
 *  - Enter has an intent-delay (`HOVER_ENTER_DELAY_MS`) before the scale
 *    animation actually begins. During that window the bucket is
 *    treated as "not yet hovered" — the preview pill is hidden.
 *  - Leave keeps the previously-hovered bucket key visible until the
 *    scale animation lands at `1.0`, so the circle visibly shrinks back
 *    instead of snapping. Once the animation completes, the active key
 *    is cleared.
 *  - Both directions use `easeOutCubic` for simplicity (per plan).
 */

const NEUTRAL_SCALE = 1;

/** Default `transitionDurMs` while no transition is in flight. Avoids
 *  divide-by-zero in {@link tickHoverAnim}'s linear-progress denominator. */
const IDLE_TRANSITION_DURATION_MS = 1;

const ANIMATION_PROGRESS_COMPLETE = 1;

export interface IHoverAnimState {
  readonly activeBucketKey: UnixTimeMs | undefined;
  readonly startScale: number;
  readonly targetScale: number;
  readonly transitionStartMs: number;
  readonly transitionDurMs: number;
  readonly enterDelayUntilMs: number;
}

export const INITIAL_HOVER_STATE: IHoverAnimState = {
  activeBucketKey: undefined,
  startScale: NEUTRAL_SCALE,
  targetScale: NEUTRAL_SCALE,
  transitionStartMs: 0,
  transitionDurMs: IDLE_TRANSITION_DURATION_MS,
  enterDelayUntilMs: 0,
};

/**
 * Begin the enter transition for a freshly-hovered bucket. Idempotent
 * if `bucketKey` already matches the current active key.
 *
 * The new `startScale` is the *current* animated scale at `nowMs`,
 * computed by ticking the previous state — that way a quick
 * leave→enter flip continues smoothly from where the leave anim was
 * mid-way through, instead of snapping back to `1.0`.
 */
export function startEnterTransition(
  prev: IHoverAnimState,
  bucketKey: UnixTimeMs,
  nowMs: number
): IHoverAnimState {
  if (prev.activeBucketKey === bucketKey && prev.targetScale === HOVER_SCALE_FACTOR) {
    return prev;
  }

  const { scale: currentScale } = tickHoverAnim(prev, nowMs);

  const enterDelayUntilMs = nowMs + HOVER_ENTER_DELAY_MS;

  return {
    activeBucketKey: bucketKey,
    startScale: currentScale,
    targetScale: HOVER_SCALE_FACTOR,
    // Anchor the clock after the intent-delay (not at `nowMs`) — anchoring earlier
    // let progress advance during the delay, showing only the eased curve's tail.
    transitionStartMs: enterDelayUntilMs,
    transitionDurMs: HOVER_ENTER_MS,
    enterDelayUntilMs,
  };
}

/**
 * Begin the leave transition. Keeps the previous `activeBucketKey` so
 * the bucket's circle visibly shrinks back to `1.0` before the renderer
 * forgets it. `enterDelayUntilMs` is reset to `0` because no enter is
 * pending.
 */
export function startLeaveTransition(prev: IHoverAnimState, nowMs: number): IHoverAnimState {
  const { scale: currentScale } = tickHoverAnim(prev, nowMs);

  return {
    activeBucketKey: prev.activeBucketKey,
    startScale: currentScale,
    targetScale: NEUTRAL_SCALE,
    transitionStartMs: nowMs,
    transitionDurMs: HOVER_LEAVE_MS,
    enterDelayUntilMs: 0,
  };
}

/**
 * Sample the current animated scale and the bucket key the renderer
 * should treat as hovered.
 *
 * Three regimes:
 *  1. Pre-enter delay (`nowMs < enterDelayUntilMs` and `targetScale > 1`):
 *     the renderer sees `activeBucketKey: undefined` and `scale: 1` —
 *     visually the hovered circle is unchanged and the pill stays hidden.
 *  2. Mid-transition: scale lerps between `startScale` and `targetScale`
 *     using `easeOutCubic` over `transitionDurMs`.
 *  3. Leave-completed (target=1, t≥1): `activeBucketKey: undefined` —
 *     the renderer forgets the bucket entirely.
 */
export function tickHoverAnim(
  state: IHoverAnimState,
  nowMs: number
): { activeBucketKey: UnixTimeMs | undefined; scale: number } {
  // Pre-delay: keep the bucket invisible until the user has paused for
  // at least `HOVER_ENTER_DELAY_MS` ms over it.
  const isEnterTarget = state.targetScale > NEUTRAL_SCALE;
  if (isEnterTarget && nowMs < state.enterDelayUntilMs) {
    return { activeBucketKey: undefined, scale: NEUTRAL_SCALE };
  }

  const linearProgress = clamp01((nowMs - state.transitionStartMs) / state.transitionDurMs);
  const easedProgress = easeOutCubic(linearProgress);
  const scale = state.startScale + (state.targetScale - state.startScale) * easedProgress;

  // Leave just landed → drop the key so the renderer skips this bucket
  // entirely on the next frame.
  const leaveCompleted =
    state.targetScale === NEUTRAL_SCALE && linearProgress >= ANIMATION_PROGRESS_COMPLETE;
  if (leaveCompleted) {
    return { activeBucketKey: undefined, scale: NEUTRAL_SCALE };
  }

  return { activeBucketKey: state.activeBucketKey, scale };
}

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function easeOutCubic(t: number): number {
  // `t` is the standard parameter name for an easing argument.
  const inverse = 1 - t;
  return 1 - inverse * inverse * inverse;
}
