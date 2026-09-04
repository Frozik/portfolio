import { SCENE_BACKGROUND_COLOR } from '@frozik/utils/webgpu/backgroundColor';
import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { DepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';
import type { MsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';
import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';
import { mat4 } from 'wgpu-matrix';

import {
  FAR_PLANE,
  FIELD_OF_VIEW_RADIANS,
  MSAA_SAMPLE_COUNT,
  NEAR_PLANE,
  VERTICES_PER_TRIANGLE,
} from '../../domain/sun-constants';
import sunShaderSource from '../shaders/sun.wgsl?raw';
import type { SunCameraController } from '../sun-camera-controller';

export const SUN_DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';
const MIN_DIMENSION = 1;

export class SunLayer implements RenderLayer {
  private readonly device: GPUDevice;
  private readonly format: GPUTextureFormat;
  private readonly pipeline: GPURenderPipeline;
  private readonly bindGroup: GPUBindGroup;
  private readonly uniformBuffer: GPUBuffer;
  private readonly uniformView: StructuredView;
  private instanceCount = 0;

  constructor(
    context: GpuContext,
    private readonly camera: SunCameraController,
    private readonly msaaManager: MsaaTextureManager,
    private readonly depthManager: DepthTextureManager,
    /** Instances to draw this frame; the composition root lowers it on weak devices. */
    private readonly readInstanceCount: () => number
  ) {
    this.device = context.device;
    this.format = context.format;

    const definitions = makeShaderDataDefinitions(sunShaderSource);
    this.uniformView = makeStructuredView(definitions.uniforms.U);
    this.uniformBuffer = this.device.createBuffer({
      size: this.uniformView.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = this.device.createShaderModule({ code: sunShaderSource });
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
      vertex: { module: shaderModule, entryPoint: 'vs' },
      fragment: { module: shaderModule, entryPoint: 'fs', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: SUN_DEPTH_FORMAT },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });

    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });
  }

  update(state: FrameState): void {
    this.camera.tick();

    const aspect = state.canvasWidth / Math.max(MIN_DIMENSION, state.canvasHeight);
    const projection = mat4.perspective(FIELD_OF_VIEW_RADIANS, aspect, NEAR_PLANE, FAR_PLANE);
    const mvp = mat4.multiply(projection, this.camera.getViewMatrix());

    this.instanceCount = this.readInstanceCount();
    this.uniformView.set({ time: state.time, instanceCount: this.instanceCount, mvp });
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformView.arrayBuffer);
  }

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
    const depthView = this.depthManager.ensureView(
      this.device,
      state.canvasWidth,
      state.canvasHeight
    );

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
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard',
      },
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(VERTICES_PER_TRIANGLE, this.instanceCount, 0, 0);
    pass.end();
  }

  dispose(): void {
    this.uniformBuffer.destroy();
  }
}
