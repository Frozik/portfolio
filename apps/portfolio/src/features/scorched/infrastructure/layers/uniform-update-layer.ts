import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';

import type { ScorchedUniforms } from '../scorched-uniforms';
import type { ScreenShake } from '../screen-shake';

/**
 * Writes the shared uniform buffer once per frame, before any layer draws with it — including the
 * §13 camera shake, which is folded into the world transform here and nowhere else.
 */
export class UniformUpdateLayer implements RenderLayer {
  private previousTimeSeconds: number | undefined;

  constructor(
    private readonly uniforms: ScorchedUniforms,
    private readonly shake: ScreenShake
  ) {}

  init(): void {}

  update(state: FrameState): void {
    const previousTimeSeconds = this.previousTimeSeconds;

    this.previousTimeSeconds = state.time;
    this.shake.advance(
      isNil(previousTimeSeconds) ? 0 : state.time - previousTimeSeconds,
      state.time
    );
    this.uniforms.write(state, this.shake.getOffset(state.time));
  }

  render(): void {}

  dispose(): void {}
}
