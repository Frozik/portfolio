import type { FrameState, GpuContext, MsaaTextureManager, RenderLayer } from '@frozik/utils';
import { isNil } from 'lodash-es';
import { mat4 } from 'wgpu-matrix';

import depthFacesShaderSource from '../shaders/depth-faces.wgsl?raw';
import edgeShaderSource from '../shaders/pyramid.wgsl?raw';
import type { OrbitalCameraController } from '../stereometry-camera-controller';
import {
  BACKGROUND_COLOR,
  EDGE_BRIGHTNESS_OVERRIDE_ID,
  FACE_DEPTH_BIAS,
  FACE_DEPTH_BIAS_SLOPE_SCALE,
  FACE_POSITION_FLOATS,
  FAR_PLANE,
  FIELD_OF_VIEW_RADIANS,
  HIDDEN_EDGE_BRIGHTNESS,
  LINE_WIDTH_PIXELS,
  MSAA_SAMPLE_COUNT,
  NEAR_PLANE,
  VERTICES_PER_LINE_QUAD,
} from '../stereometry-constants';
import { createPentagonalPyramidWireframe } from '../stereometry-geometry';

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';
const MIN_DIMENSION = 1;

const FLOAT32_BYTES = 4;

/** Per-edge instance: startPos(3) + endPos(3) = 6 floats */
const FLOATS_PER_EDGE_INSTANCE = 6;
const INSTANCE_STRIDE = FLOATS_PER_EDGE_INSTANCE * FLOAT32_BYTES;
const START_POS_OFFSET = 0;
const END_POS_OFFSET = 3 * FLOAT32_BYTES;

/** Face vertex: position only (vec3) */
const FACE_VERTEX_STRIDE = FACE_POSITION_FLOATS * FLOAT32_BYTES;

/**
 * Uniform layout (std140):
 *   mvp:       mat4x4<f32> = 64 bytes (offset 0)
 *   viewport:  vec2<f32>   =  8 bytes (offset 64)
 *   lineWidth: f32         =  4 bytes (offset 72)
 *   padding:                  4 bytes
 *   Total:                   80 bytes
 *
 * The depth-faces shader only reads mvp (first 64 bytes) from the same buffer.
 */
const UNIFORM_BUFFER_SIZE = 80;
const MVP_BYTE_OFFSET = 0;
const VIEWPORT_BYTE_OFFSET = 64;
const LINE_WIDTH_BYTE_OFFSET = 72;

/**
 * Renders a pentagonal pyramid wireframe with hidden-edge dimming.
 *
 * Three-pass rendering within a single render pass:
 * 1. Depth faces — fill depth buffer with solid face geometry (no color output)
 * 2. Hidden edges — draw edges behind faces with reduced brightness
 * 3. Visible edges — draw edges in front of faces at full brightness
 */
export class PyramidLayer implements RenderLayer {
  private device!: GPUDevice;
  private format!: GPUTextureFormat;

  private depthFacesPipeline!: GPURenderPipeline;
  private visibleEdgePipeline!: GPURenderPipeline;
  private hiddenEdgePipeline!: GPURenderPipeline;

  private bindGroup!: GPUBindGroup;
  private uniformBuffer!: GPUBuffer;
  private edgeInstanceBuffer!: GPUBuffer;
  private faceVertexBuffer!: GPUBuffer;
  private edgeCount = 0;
  private faceVertexCount = 0;
  private depthTexture: GPUTexture | null = null;

  constructor(
    private readonly camera: OrbitalCameraController,
    private readonly msaaManager: MsaaTextureManager
  ) {}

  init(context: GpuContext): void {
    this.device = context.device;
    this.format = context.format;

    const wireframe = createPentagonalPyramidWireframe();
    this.edgeCount = wireframe.edgeCount;
    this.faceVertexCount = wireframe.faceVertexCount;

    this.edgeInstanceBuffer = this.createAndWriteBuffer(
      wireframe.edgeInstances,
      GPUBufferUsage.VERTEX
    );
    this.faceVertexBuffer = this.createAndWriteBuffer(
      wireframe.facePositions,
      GPUBufferUsage.VERTEX
    );

    this.uniformBuffer = this.device.createBuffer({
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(
      this.uniformBuffer,
      LINE_WIDTH_BYTE_OFFSET,
      new Float32Array([LINE_WIDTH_PIXELS])
    );

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    this.depthFacesPipeline = this.createDepthFacesPipeline(pipelineLayout);
    this.visibleEdgePipeline = this.createEdgePipeline(pipelineLayout, 'less-equal', true);
    this.hiddenEdgePipeline = this.createEdgePipeline(pipelineLayout, 'greater', false);
  }

  update(state: FrameState): void {
    this.camera.tick();

    const viewMatrix = this.camera.getViewMatrix();
    const aspect = state.canvasWidth / Math.max(MIN_DIMENSION, state.canvasHeight);
    const projectionMatrix = mat4.perspective(FIELD_OF_VIEW_RADIANS, aspect, NEAR_PLANE, FAR_PLANE);
    const mvpMatrix = mat4.multiply(projectionMatrix, viewMatrix);

    this.device.queue.writeBuffer(this.uniformBuffer, MVP_BYTE_OFFSET, mvpMatrix as Float32Array);
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      VIEWPORT_BYTE_OFFSET,
      new Float32Array([state.canvasWidth, state.canvasHeight])
    );
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

    // Pass 1: Fill depth buffer with solid faces (no color output).
    // Depth bias pushes faces slightly back so edges at the same position win.
    pass.setPipeline(this.depthFacesPipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.faceVertexBuffer);
    pass.draw(this.faceVertexCount);

    // Pass 2: Hidden edges — behind faces, drawn with reduced brightness.
    // Depth test: greater (only where edge is behind a face). No depth write.
    pass.setPipeline(this.hiddenEdgePipeline);
    pass.setVertexBuffer(0, this.edgeInstanceBuffer);
    pass.draw(VERTICES_PER_LINE_QUAD, this.edgeCount);

    // Pass 3: Visible edges — in front of faces, full brightness.
    // Depth test: less-equal. Overwrites hidden edge pixels where both overlap.
    pass.setPipeline(this.visibleEdgePipeline);
    pass.draw(VERTICES_PER_LINE_QUAD, this.edgeCount);

    pass.end();
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.edgeInstanceBuffer.destroy();
    this.faceVertexBuffer.destroy();
    this.depthTexture?.destroy();
  }

  private createAndWriteBuffer(data: Float32Array, usage: GPUFlagsConstant): GPUBuffer {
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: usage | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  }

  private createDepthFacesPipeline(layout: GPUPipelineLayout): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({ code: depthFacesShaderSource });

    return this.device.createRenderPipeline({
      layout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: FACE_VERTEX_STRIDE,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [{ format: this.format, writeMask: 0 }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: DEPTH_FORMAT,
        depthBias: FACE_DEPTH_BIAS,
        depthBiasSlopeScale: FACE_DEPTH_BIAS_SLOPE_SCALE,
      },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });
  }

  private createEdgePipeline(
    layout: GPUPipelineLayout,
    depthCompare: GPUCompareFunction,
    depthWriteEnabled: boolean
  ): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({ code: edgeShaderSource });
    const isHidden = !depthWriteEnabled;

    return this.device.createRenderPipeline({
      layout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: INSTANCE_STRIDE,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 0, offset: START_POS_OFFSET, format: 'float32x3' },
              { shaderLocation: 1, offset: END_POS_OFFSET, format: 'float32x3' },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [{ format: this.format }],
        constants: isHidden ? { [EDGE_BRIGHTNESS_OVERRIDE_ID]: HIDDEN_EDGE_BRIGHTNESS } : undefined,
      },
      primitive: {
        topology: 'triangle-list',
      },
      depthStencil: {
        depthWriteEnabled,
        depthCompare,
        format: DEPTH_FORMAT,
      },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });
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
