import { isNil } from 'lodash-es';

export interface MsaaTextureManager {
  ensureView(
    device: GPUDevice,
    format: GPUTextureFormat,
    width: number,
    height: number
  ): GPUTextureView | null;
  dispose(): void;
}

export function createMsaaTextureManager(sampleCount: number): MsaaTextureManager {
  let msaaTexture: GPUTexture | null = null;
  let msaaView: GPUTextureView | null = null;
  let currentWidth = 0;
  let currentHeight = 0;

  return {
    ensureView(
      device: GPUDevice,
      format: GPUTextureFormat,
      width: number,
      height: number
    ): GPUTextureView | null {
      if (width === currentWidth && height === currentHeight && !isNil(msaaView)) {
        return msaaView;
      }

      msaaTexture?.destroy();

      if (width === 0 || height === 0) {
        msaaTexture = null;
        msaaView = null;
        currentWidth = 0;
        currentHeight = 0;
        return null;
      }

      msaaTexture = device.createTexture({
        size: [width, height],
        format,
        sampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      msaaView = msaaTexture.createView();
      currentWidth = width;
      currentHeight = height;

      return msaaView;
    },

    dispose(): void {
      msaaTexture?.destroy();
      msaaTexture = null;
      msaaView = null;
      currentWidth = 0;
      currentHeight = 0;
    },
  };
}
