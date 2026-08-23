import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';

import type { TanksUniforms } from '../tanks-uniforms';

/** Writes the shared uniform buffer once per frame, before any layer draws with it. */
export class UniformUpdateLayer implements RenderLayer {
  constructor(private readonly uniforms: TanksUniforms) {}

  init(): void {}

  update(state: FrameState): void {
    this.uniforms.write(state);
  }

  render(): void {}

  dispose(): void {}
}
