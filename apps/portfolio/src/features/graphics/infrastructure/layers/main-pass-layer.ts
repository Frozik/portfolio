import { SCENE_BACKGROUND_COLOR } from '@frozik/utils/webgpu/backgroundColor';
import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { MsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';

import {
  BORDER_SEGMENT_COUNT,
  computeSinXSegmentCount,
  MSAA_SAMPLE_COUNT,
  VERTICES_PER_INSTANCE,
} from '../../domain/chart-constants';
import { ALPHA_BLEND_STATE } from '../chart-gpu-constants';
import type { UniformManager } from '../uniform-manager';

/** Clears the canvas and draws the sin-X curve with the border segments. */
export class MainPassLayer implements RenderLayer {
  private readonly device: GPUDevice;
  private readonly format: GPUTextureFormat;
  private readonly pipeline: GPURenderPipeline;
  private readonly bindGroup: GPUBindGroup;

  constructor(
    context: GpuContext,
    chartShaderModule: GPUShaderModule,
    private readonly msaaManager: MsaaTextureManager,
    uniformManager: UniformManager
  ) {
    this.device = context.device;
    this.format = context.format;

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module: chartShaderModule, entryPoint: 'vs' },
      fragment: {
        module: chartShaderModule,
        entryPoint: 'fs',
        targets: [{ format: this.format, blend: ALPHA_BLEND_STATE }],
      },
      primitive: { topology: 'triangle-list' },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });
    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: uniformManager.buffer } }],
    });
  }

  update(): void {}

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView, state: FrameState): void {
    const msaaView = this.msaaManager.ensureView(
      this.device,
      this.format,
      state.canvasWidth,
      state.canvasHeight
    );
    if (isNil(msaaView)) {
      return;
    }
    const instanceCount = computeSinXSegmentCount(state.canvasWidth) + BORDER_SEGMENT_COUNT;

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: msaaView,
          resolveTarget: canvasView,
          loadOp: 'clear',
          clearValue: SCENE_BACKGROUND_COLOR,
          storeOp: 'discard',
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(VERTICES_PER_INSTANCE, instanceCount, 0, 0);
    pass.end();
  }

  dispose(): void {}
}
