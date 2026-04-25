import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { MsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';
import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';
import { mat4 } from 'wgpu-matrix';

import sunShaderSource from '../shaders/sun.wgsl?raw';
import type { OrbitalCameraController } from '../sun-camera-controller';
import {
  BACKGROUND_COLOR,
  FAR_PLANE,
  FIELD_OF_VIEW_RADIANS,
  INSTANCE_COUNT,
  MSAA_SAMPLE_COUNT,
  NEAR_PLANE,
  VERTICES_PER_TRIANGLE,
} from '../sun-constants';

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';
const MIN_DIMENSION = 1;

export class SunLayer implements RenderLayer {
  private device!: GPUDevice;
  private format!: GPUTextureFormat;
  private pipeline!: GPURenderPipeline;
  private bindGroup!: GPUBindGroup;
  private uniformBuffer!: GPUBuffer;
  private uniformView!: StructuredView;
  private depthTexture: GPUTexture | null = null;

  constructor(
    private readonly camera: OrbitalCameraController,
    private readonly msaaManager: MsaaTextureManager
  ) {}

  init(context: GpuContext): void {
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
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        constants: { INSTANCE_COUNT },
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: DEPTH_FORMAT,
      },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });

    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });
  }

  update(state: FrameState): void {
    this.camera.tick();

    const view = this.camera.getViewMatrix();
    const aspect = state.canvasWidth / Math.max(MIN_DIMENSION, state.canvasHeight);
    const proj = mat4.perspective(FIELD_OF_VIEW_RADIANS, aspect, NEAR_PLANE, FAR_PLANE);
    const mvp = mat4.multiply(proj, view);

    this.uniformView.set({
      time: state.time,
      mvp,
    });
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformView.arrayBuffer);
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView, state: FrameState): void {
    const currentMsaaView = this.msaaManager.ensureView(
      this.device,
      this.format,
      state.canvasWidth,
      state.canvasHeight
    );

    if (isNil(currentMsaaView)) {
      return;
    }

    const currentDepthTexture = this.ensureDepthTexture(state.canvasWidth, state.canvasHeight);

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
      depthStencilAttachment: {
        view: currentDepthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard',
      },
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(VERTICES_PER_TRIANGLE, INSTANCE_COUNT, 0, 0);
    pass.end();
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.depthTexture?.destroy();
  }

  private ensureDepthTexture(width: number, height: number): GPUTexture {
    if (
      !isNil(this.depthTexture) &&
      this.depthTexture.width === width &&
      this.depthTexture.height === height
    ) {
      return this.depthTexture;
    }

    this.depthTexture?.destroy();

    this.depthTexture = this.device.createTexture({
      size: [Math.max(MIN_DIMENSION, width), Math.max(MIN_DIMENSION, height)],
      format: DEPTH_FORMAT,
      sampleCount: MSAA_SAMPLE_COUNT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    return this.depthTexture;
  }
}
