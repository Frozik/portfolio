import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';

import {
  computeSinYSegmentCount,
  MSAA_SAMPLE_COUNT,
  VERTICES_PER_INSTANCE,
} from '../../domain/chart-constants';
import { ALPHA_BLEND_STATE, OFFSCREEN_FORMAT } from '../chart-gpu-constants';
import type { OffscreenTextureManager } from '../chart-textures';
import type { UniformManager } from '../uniform-manager';

/** Draws the sin-Y curve into the offscreen target that `CompositeLayer` blends over the canvas. */
export class SinYLayer implements RenderLayer {
  private readonly pipeline: GPURenderPipeline;
  private readonly bindGroup: GPUBindGroup;

  constructor(
    context: GpuContext,
    private readonly textureManager: OffscreenTextureManager,
    chartShaderModule: GPUShaderModule,
    uniformManager: UniformManager
  ) {
    const { device } = context;
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });
    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module: chartShaderModule, entryPoint: 'vsSinY' },
      fragment: {
        module: chartShaderModule,
        entryPoint: 'fsSinY',
        targets: [{ format: OFFSCREEN_FORMAT, blend: ALPHA_BLEND_STATE }],
      },
      primitive: { topology: 'triangle-list' },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });
    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: uniformManager.buffer } }],
    });
  }

  update(): void {}

  render(encoder: GPUCommandEncoder, _canvasView: GPUTextureView, state: FrameState): void {
    const offscreen = this.textureManager.ensure(state.canvasWidth, state.canvasHeight);
    if (isNil(offscreen)) {
      return;
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: offscreen.msaaView,
          resolveTarget: offscreen.resolveView,
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: 'discard',
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(VERTICES_PER_INSTANCE, computeSinYSegmentCount(state.canvasHeight), 0, 0);
    pass.end();
  }

  dispose(): void {}
}
