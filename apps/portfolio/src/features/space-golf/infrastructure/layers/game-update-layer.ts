import type { RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { createUpdateOnlyLayer } from '@frozik/utils/webgpu/updateOnlyLayer';
import { isNil } from 'lodash-es';

/**
 * Advances the game by the time elapsed since the previous frame, ahead of
 * the layer that draws it. The board is never still — the dust drifts along
 * gravity even while the ball rests — so every frame is drawn and this layer
 * runs on each one.
 */
export function createGameUpdateLayer(advance: (seconds: number) => void): RenderLayer {
  let lastTime: number | undefined;

  return createUpdateOnlyLayer(state => {
    const elapsed = isNil(lastTime) ? 0 : state.time - lastTime;
    lastTime = state.time;
    advance(elapsed);
  });
}
