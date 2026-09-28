import { isNil } from 'lodash-es';

import type { PlayerInputs } from './types';

/** The touch stick wins while a thumb tilts it; fire is the OR of both devices. */
export function mergePlayerInputs(
  keyboardInputs: PlayerInputs,
  touchInputs: PlayerInputs
): PlayerInputs {
  return {
    direction: isNil(touchInputs.direction) ? keyboardInputs.direction : touchInputs.direction,
    fire: keyboardInputs.fire || touchInputs.fire,
  };
}
