import { isNil } from 'lodash-es';

export interface ChartTextureManager {
  ensureMsaaTexture(width: number, height: number): GPUTextureView | null;
  ensureOffscreenTextures(
    width: number,
    height: number,
    compositeBindGroupLayout: GPUBindGroupLayout,
    compositeSampler: GPUSampler,
    compositeUniformBuf: GPUBuffer
  ): {
    offscreenMsaaView: GPUTextureView;
    offscreenResolveView: GPUTextureView;
    compositeBindGroup: GPUBindGroup;
  } | null;
  destroy(): void;
}

export function createChartTextureManager(
  device: GPUDevice,
  format: GPUTextureFormat,
  offscreenFormat: GPUTextureFormat,
  msaaSampleCount: number
): ChartTextureManager {
  let msaaTexture: GPUTexture | null = null;
  let msaaView: GPUTextureView | null = null;

  let offscreenMsaaTexture: GPUTexture | null = null;
  let offscreenMsaaView: GPUTextureView | null = null;
  let offscreenResolveTexture: GPUTexture | null = null;
  let offscreenResolveView: GPUTextureView | null = null;
  let compositeBindGroup: GPUBindGroup | null = null;

  return {
    ensureMsaaTexture(width: number, height: number): GPUTextureView | null {
      if (!isNil(msaaTexture) && msaaTexture.width === width && msaaTexture.height === height) {
        return msaaView;
      }

      msaaTexture?.destroy();

      if (width === 0 || height === 0) {
        msaaTexture = null;
        msaaView = null;
        return null;
      }

      msaaTexture = device.createTexture({
        size: [width, height],
        format,
        sampleCount: msaaSampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      msaaView = msaaTexture.createView();
      return msaaView;
    },

    ensureOffscreenTextures(
      width: number,
      height: number,
      compositeBindGroupLayout: GPUBindGroupLayout,
      compositeSampler: GPUSampler,
      compositeUniformBuf: GPUBuffer
    ) {
      if (
        !isNil(offscreenMsaaTexture) &&
        offscreenMsaaTexture.width === width &&
        offscreenMsaaTexture.height === height
      ) {
        if (isNil(offscreenMsaaView) || isNil(offscreenResolveView) || isNil(compositeBindGroup)) {
          return null;
        }
        return { offscreenMsaaView, offscreenResolveView, compositeBindGroup };
      }

      offscreenMsaaTexture?.destroy();
      offscreenResolveTexture?.destroy();

      if (width === 0 || height === 0) {
        offscreenMsaaTexture = null;
        offscreenMsaaView = null;
        offscreenResolveTexture = null;
        offscreenResolveView = null;
        compositeBindGroup = null;
        return null;
      }

      offscreenMsaaTexture = device.createTexture({
        size: [width, height],
        format: offscreenFormat,
        sampleCount: msaaSampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      offscreenMsaaView = offscreenMsaaTexture.createView();

      offscreenResolveTexture = device.createTexture({
        size: [width, height],
        format: offscreenFormat,
        sampleCount: 1,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      offscreenResolveView = offscreenResolveTexture.createView();

      compositeBindGroup = device.createBindGroup({
        layout: compositeBindGroupLayout,
        entries: [
          { binding: 0, resource: offscreenResolveView },
          { binding: 1, resource: compositeSampler },
          { binding: 2, resource: { buffer: compositeUniformBuf } },
        ],
      });

      return { offscreenMsaaView, offscreenResolveView, compositeBindGroup };
    },

    destroy(): void {
      msaaTexture?.destroy();
      offscreenMsaaTexture?.destroy();
      offscreenResolveTexture?.destroy();
    },
  };
}
