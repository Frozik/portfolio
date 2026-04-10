import { isNil } from 'lodash-es';

import { ALPHA_BLEND_STATE, SIN_Y_LAYER_OPACITY } from '../chart-constants';
import type { OffscreenTextureManager } from '../chart-textures';
import compositeShaderSource from '../shaders/composite.wgsl?raw';
import type { FrameState, GpuContext, RenderLayer } from '../types';

const FULLSCREEN_TRIANGLE_VERTEX_COUNT = 3;
const COMPOSITE_UNIFORM_ALIGNMENT = 16;

export interface CompositeLayerResources {
  readonly compositeBindGroupLayout: GPUBindGroupLayout;
  readonly compositeSampler: GPUSampler;
  readonly compositeUniformBuffer: GPUBuffer;
}

export function createCompositeLayerResources(device: GPUDevice): CompositeLayerResources {
  const compositeBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const compositeSampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  const compositeUniformBuffer = device.createBuffer({
    size: COMPOSITE_UNIFORM_ALIGNMENT,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const opacityData = new Float32Array([SIN_Y_LAYER_OPACITY, 0, 0, 0]);
  device.queue.writeBuffer(compositeUniformBuffer, 0, opacityData);

  return {
    compositeBindGroupLayout,
    compositeSampler,
    compositeUniformBuffer,
  };
}

export class CompositeLayer implements RenderLayer {
  private compositePipeline!: GPURenderPipeline;

  constructor(
    private readonly textureManager: OffscreenTextureManager,
    private readonly resources: CompositeLayerResources
  ) {}

  init(context: GpuContext): void {
    const { device, format } = context;

    const compositeShaderModule = device.createShaderModule({
      code: compositeShaderSource,
    });

    this.compositePipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.resources.compositeBindGroupLayout],
      }),
      vertex: {
        module: compositeShaderModule,
        entryPoint: 'vsComposite',
      },
      fragment: {
        module: compositeShaderModule,
        entryPoint: 'fsComposite',
        targets: [{ format, blend: ALPHA_BLEND_STATE }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  update(_state: FrameState): void {
    // No per-frame update needed
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView, state: FrameState): void {
    const offscreen = this.textureManager.ensureOffscreenTextures(
      state.canvasWidth,
      state.canvasHeight,
      this.resources.compositeBindGroupLayout,
      this.resources.compositeSampler,
      this.resources.compositeUniformBuffer
    );

    if (isNil(offscreen)) {
      return;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: canvasView,
          loadOp: 'load',
          storeOp: 'store',
        },
      ],
    });

    pass.setPipeline(this.compositePipeline);
    pass.setBindGroup(0, offscreen.compositeBindGroup);
    pass.draw(FULLSCREEN_TRIANGLE_VERTEX_COUNT, 1, 0, 0);

    pass.end();
  }

  dispose(): void {
    this.resources.compositeUniformBuffer.destroy();
  }
}
