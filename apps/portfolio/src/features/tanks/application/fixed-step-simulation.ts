import { isNil } from 'lodash-es';

import { TICKS_PER_SECOND } from '../domain/constants';

const SECONDS_PER_TICK = 1 / TICKS_PER_SECOND;
/** Tab-switch stalls must not be replayed. */
const MAX_TICKS_PER_FRAME = 4;
const MAX_ACCUMULATED_SECONDS = MAX_TICKS_PER_FRAME * SECONDS_PER_TICK;

export interface IFixedStepSimulation {
  /** Runs as many fixed steps as the frame clock has earned since the previous call. */
  advance(timeSeconds: number): void;
}

/** Steps run only while `isRunning`; time that passes while stopped is dropped, never replayed. */
export function createFixedStepSimulation({
  isRunning,
  step,
}: {
  readonly isRunning: () => boolean;
  readonly step: () => void;
}): IFixedStepSimulation {
  let accumulatedSeconds = 0;
  let previousTimeSeconds: number | undefined;

  return {
    advance(timeSeconds: number): void {
      const elapsedSeconds = isNil(previousTimeSeconds) ? 0 : timeSeconds - previousTimeSeconds;
      previousTimeSeconds = timeSeconds;

      if (!isRunning()) {
        accumulatedSeconds = 0;

        return;
      }

      accumulatedSeconds = Math.min(accumulatedSeconds + elapsedSeconds, MAX_ACCUMULATED_SECONDS);

      while (accumulatedSeconds >= SECONDS_PER_TICK) {
        step();
        accumulatedSeconds -= SECONDS_PER_TICK;
      }
    },
  };
}
