import type { BallisticsEnvironment } from '../ballistics';
import { createEnvironment } from '../ballistics';
import { getGuidedWindAcceleration } from '../items/behaviors';
import type { GuidanceKind } from '../types';
import type { RoundState } from './round-state';

/** The round's physics as a shell sees it, with a guidance device cancelling the wind if fitted. */
export function createRoundEnvironment(
  state: RoundState,
  guidance: GuidanceKind | undefined
): BallisticsEnvironment {
  const environment = createEnvironment(
    state.options.physics,
    state.windUnits,
    state.wallMode,
    state.field.length
  );

  return {
    ...environment,
    windAccelerationWuPerTickSquared: getGuidedWindAcceleration(
      guidance,
      environment.windAccelerationWuPerTickSquared
    ),
  };
}
