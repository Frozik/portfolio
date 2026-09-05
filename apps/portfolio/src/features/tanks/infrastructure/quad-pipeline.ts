import { ANIMATION_TICKS_PER_FRAME } from './render-constants';
import commonShaderSource from './shaders/common.wgsl?raw';
import quadsShaderSource from './shaders/quads.wgsl?raw';

const quadShaderSource = commonShaderSource + quadsShaderSource;

export interface QuadPipeline {
  readonly device: GPUDevice;
  readonly pipeline: GPURenderPipeline;
  createBindGroup(instanceBuffer: GPUBuffer): GPUBindGroup;
}

/** No MSAA and a nearest sampler keep the pixel art crisp. */
export function createQuadPipeline(params: {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly uniformBuffer: GPUBuffer;
  readonly atlasTextureView: GPUTextureView;
}): QuadPipeline {
  const { device, format, uniformBuffer, atlasTextureView } = params;

  const shaderModule = device.createShaderModule({ code: quadShaderSource });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
    ],
  });

  const sampler = device.createSampler({
    magFilter: 'nearest',
    minFilter: 'nearest',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module: shaderModule,
      entryPoint: 'vsQuad',
      constants: { ANIMATION_TICKS_PER_FRAME },
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fsQuad',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
  });

  return {
    device,
    pipeline,
    createBindGroup(instanceBuffer: GPUBuffer): GPUBindGroup {
      return device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: instanceBuffer } },
          { binding: 2, resource: atlasTextureView },
          { binding: 3, resource: sampler },
        ],
      });
    },
  };
}
