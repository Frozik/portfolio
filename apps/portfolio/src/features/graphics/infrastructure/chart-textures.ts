import { isNil } from 'lodash-es';

export interface OffscreenTargets {
  readonly msaaView: GPUTextureView;
  readonly resolveView: GPUTextureView;
  /** Composite bind group sampling `resolveView`; rebuilt with the textures. */
  readonly compositeBindGroup: GPUBindGroup;
}

export interface OffscreenTextureManager {
  ensure(width: number, height: number): OffscreenTargets | undefined;
  dispose(): void;
}

/**
 * The MSAA offscreen target the sin-Y pass draws into and the composite pass
 * samples, kept in step with the canvas size.
 */
export function createOffscreenTextureManager(
  device: GPUDevice,
  options: {
    readonly format: GPUTextureFormat;
    readonly sampleCount: number;
    readonly compositeBindGroupLayout: GPUBindGroupLayout;
    readonly compositeSampler: GPUSampler;
    readonly compositeUniformBuffer: GPUBuffer;
  }
): OffscreenTextureManager {
  let msaaTexture: GPUTexture | undefined;
  let resolveTexture: GPUTexture | undefined;
  let targets: OffscreenTargets | undefined;

  function destroyTextures(): void {
    msaaTexture?.destroy();
    resolveTexture?.destroy();
    msaaTexture = undefined;
    resolveTexture = undefined;
    targets = undefined;
  }

  return {
    ensure(width: number, height: number): OffscreenTargets | undefined {
      if (!isNil(msaaTexture) && msaaTexture.width === width && msaaTexture.height === height) {
        return targets;
      }
      destroyTextures();
      if (width === 0 || height === 0) {
        return undefined;
      }

      msaaTexture = device.createTexture({
        size: [width, height],
        format: options.format,
        sampleCount: options.sampleCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      resolveTexture = device.createTexture({
        size: [width, height],
        format: options.format,
        sampleCount: 1,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      const resolveView = resolveTexture.createView();
      targets = {
        msaaView: msaaTexture.createView(),
        resolveView,
        compositeBindGroup: device.createBindGroup({
          layout: options.compositeBindGroupLayout,
          entries: [
            { binding: 0, resource: resolveView },
            { binding: 1, resource: options.compositeSampler },
            { binding: 2, resource: { buffer: options.compositeUniformBuffer } },
          ],
        }),
      };
      return targets;
    },

    dispose: destroyTextures,
  };
}
