import commonShaderSource from './shaders/common.wgsl?raw';
import shapesShaderSource from './shaders/shapes.wgsl?raw';

const shapeShaderSource = commonShaderSource + shapesShaderSource;

export interface ShapePipeline {
  readonly device: GPUDevice;
  readonly pipeline: GPURenderPipeline;
  createBindGroup(instanceBuffer: GPUBuffer): GPUBindGroup;
}

/**
 * Tanks and shells share one pipeline: the same oriented quad, the same uniforms, a per-instance
 * colour. Only the instance storage buffer differs, so each layer gets its own bind group.
 * Straight alpha blending lets a trace path fade out behind the shell that drew it.
 */
export function createShapePipeline(params: {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly uniformBuffer: GPUBuffer;
}): ShapePipeline {
  const { device, format, uniformBuffer } = params;

  const shaderModule = device.createShaderModule({ code: shapeShaderSource });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
    ],
  });

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: { module: shaderModule, entryPoint: 'vsShape' },
    fragment: {
      module: shaderModule,
      entryPoint: 'fsShape',
      targets: [
        {
          format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
          },
        },
      ],
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
        ],
      });
    },
  };
}
