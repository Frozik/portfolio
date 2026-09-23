import type { Vector2 } from '@frozik/utils/math/vector2';

import type { CometSky } from './comets';
import { advanceCometSky, createCometSky } from './comets';
import type { DeepSky } from './deep-sky';
import { advanceDeepSky, createDeepSky } from './deep-sky';
import type { DustWindow, ParticleField } from './particles';
import { advanceParticles, createParticleField } from './particles';

/** The dust lives in what the camera shows and this much more, so none pops in at the edge. */
const DUST_MARGIN_METERS = 2;

/**
 * Everything behind the board, nearest last: the deep sky of galaxies and
 * nebulae, the dust that shows where gravity pulls, and the comet now and
 * then crossing over both. One thing owns their lives, so the layer that
 * draws them has only to draw.
 */
export interface Sky {
  readonly deep: DeepSky;
  readonly dust: ParticleField;
  readonly comets: CometSky;
}

export function createSky(seed: number, visible: DustWindow): Sky {
  return {
    deep: createDeepSky(seed, visible),
    dust: createParticleField(seed, dustWindowOf(visible)),
    comets: createCometSky(seed),
  };
}

/** The sky a frame later: each of its layers gone on by `elapsed`, over what the camera shows now. */
export function advanceSky(
  sky: Sky,
  frame: { readonly elapsed: number; readonly gravity: Vector2; readonly visible: DustWindow }
): Sky {
  return {
    deep: advanceDeepSky(sky.deep, frame.elapsed, frame.visible),
    dust: advanceParticles(sky.dust, frame.gravity, frame.elapsed, dustWindowOf(frame.visible)),
    comets: advanceCometSky(sky.comets, frame.elapsed, frame.visible),
  };
}

function dustWindowOf(visible: DustWindow): DustWindow {
  return {
    min: { x: visible.min.x - DUST_MARGIN_METERS, y: visible.min.y - DUST_MARGIN_METERS },
    max: { x: visible.max.x + DUST_MARGIN_METERS, y: visible.max.y + DUST_MARGIN_METERS },
  };
}
