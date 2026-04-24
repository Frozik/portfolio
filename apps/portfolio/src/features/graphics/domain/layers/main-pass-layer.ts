import type { FrameState, GpuContext, MsaaTextureManager, RenderLayer } from '@frozik/utils';
import { isNil } from 'lodash-es';

import {
  ALPHA_BLEND_STATE,
  BACKGROUND_COLOR,
  BORDER_SEGMENT_COUNT,
  computeSinXSegmentCount,
  MSAA_SAMPLE_COUNT,
  VERTICES_PER_INSTANCE,
} from '../chart-constants';
import commonShaderSource from '../shaders/common.wgsl?raw';
import type { UniformManager } from '../uniform-manager';
import { createUniformManager } from '../uniform-manager';

export class MainPassLayer implements RenderLayer {
  private device!: GPUDevice;
  private format!: GPUTextureFormat;
  private uniformManager!: UniformManager;
  private pipeline!: GPURenderPipeline;
  private bindGroup!: GPUBindGroup;

  constructor(
    private readonly chartShaderModule: GPUShaderModule,
    private readonly msaaManager: MsaaTextureManager
  ) {}

  init(context: GpuContext): void {
    this.device = context.device;
    this.format = context.format;
    this.uniformManager = createUniformManager(this.device, commonShaderSource);

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

  update(state: FrameState): void {
    this.uniformManager.writeFromFrameState(this.device, state);
  }

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
          clearValue: BACKGROUND_COLOR,
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

  dispose(): void {
    this.uniformManager.dispose();
  }
}
