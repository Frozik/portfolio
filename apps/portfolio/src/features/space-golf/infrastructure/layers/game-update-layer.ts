import type { FpsController } from '@frozik/utils/webgpu/fpsController';
import type { RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { createUpdateOnlyLayer } from '@frozik/utils/webgpu/updateOnlyLayer';
import { isNil } from 'lodash-es';

import { FPS_ACTIVE } from '../render-constants';
import type { SceneFrame } from '../render/scene-frame';

/**
 * Advances the game by the frame's elapsed time and asks for a redraw
 * whenever the picture changes: the ball state is replaced on every step
 * and on every teleport (a respawn after the burst, a restart), the burst
 * and the band animate, a new level arrives. A board at rest is redrawn at
 * the idle rate only.
 */
export function createGameUpdateLayer({
  advance,
  getScene,
  fpsController,
  markDirty,
}: {
  readonly advance: (seconds: number) => void;
  readonly getScene: () => SceneFrame | undefined;
  readonly fpsController: FpsController;
  readonly markDirty: VoidFunction;
}): RenderLayer {
  let lastTime: number | undefined;
  let lastLevel: SceneFrame['level'] | undefined;
  let lastBall: SceneFrame['ball'] | undefined;

  return createUpdateOnlyLayer(state => {
    const elapsed = isNil(lastTime) ? 0 : state.time - lastTime;
    lastTime = state.time;
    advance(elapsed);
    const scene = getScene();
    if (isNil(scene)) {
      return;
    }
    const moving =
      scene.ball !== lastBall ||
      !isNil(scene.burst) ||
      !isNil(scene.preview) ||
      scene.level !== lastLevel;
    lastLevel = scene.level;
    lastBall = scene.ball;
    if (moving) {
      fpsController.raise(FPS_ACTIVE);
      markDirty();
    }
  });
}
