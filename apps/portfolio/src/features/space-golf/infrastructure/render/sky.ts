import type { Vector2 } from '@frozik/utils/math/vector2';

import type { CometSky } from './comets';
import { advanceCometSky, createCometSky } from './comets';
import type { DeepSky } from './deep-sky';
import { advanceDeepSky, createDeepSky } from './deep-sky';
import type { DustWindow, ParticleField } from './particles';
import { advanceParticles, createParticleField } from './particles';
import { grownBy } from './sky-window';
import type { StationSky } from './station';
import { advanceStationSky, createStationSky } from './station';

/** The dust lives in what the camera shows and this much more, so none pops in at the edge. */
const DUST_MARGIN_METERS = 2;

/**
 * Everything behind the board, nearest last: the deep sky of galaxies and
 * nebulae, the station falling past in front of them, the dust that shows
 * where gravity pulls, and the comet now and then crossing over them all.
 * One thing owns their lives, so the layer that draws them has only to draw.
 */
export interface Sky {
  readonly deep: DeepSky;
  readonly stations: StationSky;
  readonly dust: ParticleField;
  readonly comets: CometSky;
}

export function createSky(seed: number, visible: DustWindow): Sky {
  return {
    deep: createDeepSky(seed, visible),
    stations: createStationSky(seed, visible),
    dust: createParticleField(seed, grownBy(visible, DUST_MARGIN_METERS)),
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
    stations: advanceStationSky(sky.stations, frame.gravity, frame.elapsed, frame.visible),
    dust: advanceParticles(
      sky.dust,
      frame.gravity,
      frame.elapsed,
      grownBy(frame.visible, DUST_MARGIN_METERS)
    ),
    comets: advanceCometSky(sky.comets, frame.elapsed, frame.visible),
  };
}
