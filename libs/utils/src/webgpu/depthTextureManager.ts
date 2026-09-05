import { isNil } from 'lodash-es';

/** A canvas reported at zero has no texture to allocate; one texel keeps it legal. */
const MIN_TEXTURE_DIMENSION = 1;

export interface DepthTextureManager {
  ensureView(device: GPUDevice, width: number, height: number): GPUTextureView;
  dispose(): void;
}

/**
 * One attachment kept in step with the canvas size, shaped after
 * `createMsaaTextureManager`. Owned by the scene rather than by a layer so
 * passes drawn separately can still occlude each other through it. With a
 * `TEXTURE_BINDING` usage it doubles as the texture a later pass samples.
 */
export function createDepthTextureManager(
  sampleCount: number,
  format: GPUTextureFormat,
  usage: GPUTextureUsageFlags = GPUTextureUsage.RENDER_ATTACHMENT
): DepthTextureManager {
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
      depthTexture = device.createTexture({
        size: [textureWidth, textureHeight],
        format,
        sampleCount,
        usage,
      });
      depthView = depthTexture.createView();
      return depthView;
    },

    dispose(): void {
      depthTexture?.destroy();
      depthTexture = undefined;
      depthView = undefined;
    },
  };
}
