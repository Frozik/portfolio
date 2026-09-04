import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';

import { SIN_Y_LAYER_OPACITY } from '../../domain/chart-constants';
import { ALPHA_BLEND_STATE } from '../chart-gpu-constants';
import type { OffscreenTextureManager } from '../chart-textures';
import compositeShaderSource from '../shaders/composite.wgsl?raw';

const FULLSCREEN_TRIANGLE_VERTEX_COUNT = 3;
const COMPOSITE_UNIFORM_ALIGNMENT = 16;

/** Bindings shared by the offscreen targets and the composite pipeline; owned by the composition root. */
export interface CompositeLayerResources {
  readonly bindGroupLayout: GPUBindGroupLayout;
  readonly sampler: GPUSampler;
  readonly uniformBuffer: GPUBuffer;
  dispose(): void;
}

export function createCompositeLayerResources(device: GPUDevice): CompositeLayerResources {
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    ],
  });
  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  const uniformBuffer = device.createBuffer({
    size: COMPOSITE_UNIFORM_ALIGNMENT,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([SIN_Y_LAYER_OPACITY, 0, 0, 0]));

  return {
    bindGroupLayout,
    sampler,
    uniformBuffer,
    dispose(): void {
      uniformBuffer.destroy();
    },
  };
}

/** Blends the offscreen sin-Y image over the canvas with a fullscreen triangle. */
export class CompositeLayer implements RenderLayer {
  private readonly pipeline: GPURenderPipeline;

  constructor(
    context: GpuContext,
    private readonly textureManager: OffscreenTextureManager,
    resources: CompositeLayerResources
  ) {
    const { device, format } = context;
    const shaderModule = device.createShaderModule({ code: compositeShaderSource });
    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [resources.bindGroupLayout] }),
      vertex: { module: shaderModule, entryPoint: 'vsComposite' },
      fragment: {
        module: shaderModule,
        entryPoint: 'fsComposite',
        targets: [{ format, blend: ALPHA_BLEND_STATE }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  update(): void {}

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView, state: FrameState): void {
    const offscreen = this.textureManager.ensure(state.canvasWidth, state.canvasHeight);
    if (isNil(offscreen)) {
      return;
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: canvasView, loadOp: 'load', storeOp: 'store' }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, offscreen.compositeBindGroup);
    pass.draw(FULLSCREEN_TRIANGLE_VERTEX_COUNT, 1, 0, 0);
    pass.end();
  }

  dispose(): void {}
}
