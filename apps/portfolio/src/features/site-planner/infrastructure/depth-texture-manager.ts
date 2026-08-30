import { isNil } from 'lodash-es';

import { DEPTH_FORMAT } from './render-constants';

/** A canvas reported at zero has no texture to allocate; one texel keeps it legal. */
const MIN_TEXTURE_DIMENSION = 1;

export interface DepthTextureManager {
  ensureView(device: GPUDevice, width: number, height: number): GPUTextureView;
  dispose(): void;
}

/**
 * The one depth buffer of the 3D view, shaped after `createMsaaTextureManager`.
 *
 * The ground and the objects standing on it are drawn in separate passes and
 * have to occlude each other, so the depth texture belongs to the scene rather
 * than to whichever layer happens to allocate it first — the ground pass clears
 * and stores it, the objects pass loads and tests against it.
 */
export function createDepthTextureManager(sampleCount: number): DepthTextureManager {
  let depthTexture: GPUTexture | undefined;
  let depthView: GPUTextureView | undefined;

  return {
    ensureView(device: GPUDevice, width: number, height: number): GPUTextureView {
      const textureWidth = Math.max(MIN_TEXTURE_DIMENSION, width);
      const textureHeight = Math.max(MIN_TEXTURE_DIMENSION, height);

      if (
        !isNil(depthTexture) &&
        !isNil(depthView) &&
        depthTexture.width === textureWidth &&
        depthTexture.height === textureHeight
      ) {
        return depthView;
      }

      depthTexture?.destroy();

      const nextTexture = device.createTexture({
        size: [textureWidth, textureHeight],
        format: DEPTH_FORMAT,
        sampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      const nextView = nextTexture.createView();

      depthTexture = nextTexture;
      depthView = nextView;

      return nextView;
    },

    dispose(): void {
      depthTexture?.destroy();
      depthTexture = undefined;
      depthView = undefined;
    },
  };
}
