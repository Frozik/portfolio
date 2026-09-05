const MIN_FPS = 30;
// Without a cap the multiplier grows while FPS stays healthy, scheduling ever
// more simulation work per frame until the tab stalls.
const MAX_SPEED_MULTIPLIER = 16;

const MIN_SUBSTEP_MS = 8;
const SUBSTEP_JITTER_MS = 24;
const SUBSTEP_PRECISION = 100;

/** Substeps to simulate for one frame's delta at the given speed multiplier. */
export type TSubstepPolicy = (
  deltaTime: DOMHighResTimeStamp,
  multiplier: number
) => readonly DOMHighResTimeStamp[];

/** Steps up by one while the frame rate holds, down by one when it drops. */
export function nextSpeedMultiplier(current: number, fps: number): number {
  return fps < MIN_FPS ? Math.max(1, current - 1) : Math.min(MAX_SPEED_MULTIPLIER, current + 1);
}

export const realTimeStep: TSubstepPolicy = deltaTime => [deltaTime];

/**
 * Training runs `multiplier` steps per frame with randomized lengths so the
 * networks do not overfit one fixed time step.
 */
export function randomizedSubsteps(
  multiplier: number,
  randomUnit: () => number = Math.random
): readonly DOMHighResTimeStamp[] {
  return Array.from(
    { length: multiplier },
    () =>
      MIN_SUBSTEP_MS +
      Math.round(randomUnit() * SUBSTEP_JITTER_MS * SUBSTEP_PRECISION) / SUBSTEP_PRECISION
  );
}
