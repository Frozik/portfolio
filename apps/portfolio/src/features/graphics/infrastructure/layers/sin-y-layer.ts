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

export class SinYLayer implements RenderLayer {
  private device!: GPUDevice;
  private sinYPipeline!: GPURenderPipeline;
  private bindGroup!: GPUBindGroup;

  constructor(
    private readonly textureManager: OffscreenTextureManager,
    private readonly compositeBindGroupLayout: GPUBindGroupLayout,
    private readonly compositeSampler: GPUSampler,
    private readonly compositeUniformBuffer: GPUBuffer,
    private readonly chartShaderModule: GPUShaderModule,
    private readonly uniformManager: UniformManager
  ) {}

  init(context: GpuContext): void {
    this.device = context.device;

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    this.sinYPipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: { module: this.chartShaderModule, entryPoint: 'vsSinY' },
      fragment: {
        module: this.chartShaderModule,
        entryPoint: 'fsSinY',
        targets: [{ format: OFFSCREEN_FORMAT, blend: ALPHA_BLEND_STATE }],
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

  render(encoder: GPUCommandEncoder, _canvasView: GPUTextureView, state: FrameState): void {
    const sinYCount = computeSinYSegmentCount(state.canvasHeight);

    const offscreen = this.textureManager.ensureOffscreenTextures(
      state.canvasWidth,
      state.canvasHeight,
      this.compositeBindGroupLayout,
      this.compositeSampler,
      this.compositeUniformBuffer
    );

    if (isNil(offscreen)) {
      return;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: offscreen.offscreenMsaaView,
          resolveTarget: offscreen.offscreenResolveView,
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: 'discard',
        },
      ],
    });

    pass.setPipeline(this.sinYPipeline);
    pass.setBindGroup(0, this.bindGroup);

    if (sinYCount > 0) {
      pass.draw(VERTICES_PER_INSTANCE, sinYCount, 0, 0);
    }

    pass.end();
  }

  dispose(): void {}
}
