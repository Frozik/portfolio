import { isNil } from 'lodash-es';

import type { PlayerInputs } from './types';

/** The touch D-pad wins while a thumb rests on it; fire is the OR of both devices (§12.1). */
export function mergePlayerInputs(
  keyboardInputs: PlayerInputs,
  touchInputs: PlayerInputs
): PlayerInputs {
  return {
    direction: isNil(touchInputs.direction) ? keyboardInputs.direction : touchInputs.direction,
    fire: keyboardInputs.fire || touchInputs.fire,
  };
}
