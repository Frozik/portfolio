import type { RenderLayer } from '@frozik/utils/webgpu/renderLayer';

import type { ShadowMap } from '../shadow-map';
import type { ShadowCaster } from './shadow-caster';

/**
 * Fills the shadow map: one depth-only pass from the sun, before anything is
 * drawn for the eye — the ground and everything standing on it read the finished
 * map in the passes that follow.
 *
 * It draws nothing of its own. Each caster encodes the geometry it already owns
 * (see {@link ShadowCaster}), and the pass is opened even with the sun down: it
 * clears the map to "nothing in the way", which is what a night — where the
 * direct light the shadow multiplies is zero anyway — leaves behind.
 */
export class ShadowLayer implements RenderLayer {
  constructor(
    private readonly shadowMap: ShadowMap,
    private readonly casters: readonly ShadowCaster[],
    private readonly isSunUp: () => boolean
  ) {}

  init(): void {}

  update(): void {}

  render(encoder: GPUCommandEncoder): void {
    const pass = encoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.shadowMap.depthView,
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    if (this.isSunUp()) {
      for (const caster of this.casters) {
        caster.drawShadow(pass);
      }
    }

    pass.end();
  }

  dispose(): void {}
}
