import type { RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { createUpdateOnlyLayer } from '@frozik/utils/webgpu/updateOnlyLayer';
import { isNil } from 'lodash-es';

import type { ScorchedUniforms } from '../scorched-uniforms';
import type { ScreenShake } from '../screen-shake';

/**
 * Writes the shared uniform buffer once per frame, before any layer draws with it — including the
 * camera shake, which is folded into the world transform here and nowhere else.
 */
export function createUniformUpdateLayer(
  uniforms: ScorchedUniforms,
  shake: ScreenShake
): RenderLayer {
  let previousTimeSeconds: number | undefined;

  return createUpdateOnlyLayer(state => {
    const elapsedSeconds = isNil(previousTimeSeconds) ? 0 : state.time - previousTimeSeconds;

    previousTimeSeconds = state.time;
    shake.advance(elapsedSeconds, state.time);
    uniforms.write(state, shake.getOffset(state.time));
  });
}
