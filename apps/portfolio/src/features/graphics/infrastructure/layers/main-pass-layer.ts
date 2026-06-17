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

export class MainPassLayer implements RenderLayer {
  private device!: GPUDevice;
  private format!: GPUTextureFormat;
  private pipeline!: GPURenderPipeline;
  private bindGroup!: GPUBindGroup;

  constructor(
    private readonly chartShaderModule: GPUShaderModule,
    private readonly msaaManager: MsaaTextureManager,
    private readonly uniformManager: UniformManager
  ) {}

  init(context: GpuContext): void {
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
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: { module: this.chartShaderModule, entryPoint: 'vs' },
      fragment: {
        module: this.chartShaderModule,
        entryPoint: 'fs',
        targets: [{ format: this.format, blend: ALPHA_BLEND_STATE }],
      },
      primitive: { topology: 'triangle-list' },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });

    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformManager.buffer },
        },
      ],
    });
  }

  update(): void {}

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView, state: FrameState): void {
    const sinXCount = computeSinXSegmentCount(state.canvasWidth);
    const mainInstances = sinXCount + BORDER_SEGMENT_COUNT;

    const currentMsaaView = this.msaaManager.ensureView(
      this.device,
      this.format,
      state.canvasWidth,
      state.canvasHeight
    );

    if (isNil(currentMsaaView)) {
      return;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: currentMsaaView,
          resolveTarget: canvasView,
          loadOp: 'clear',
          clearValue: SCENE_BACKGROUND_COLOR,
          storeOp: 'discard',
        },
      ],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);

    if (mainInstances > 0) {
      pass.draw(VERTICES_PER_INSTANCE, mainInstances, 0, 0);
    }

    pass.end();
  }

  dispose(): void {}
}
