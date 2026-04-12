import type { FrameState, GpuContext, MsaaTextureManager, RenderLayer } from '@frozik/utils';
import { isNil } from 'lodash-es';
import { mat4 } from 'wgpu-matrix';

import depthFacesShaderSource from '../shaders/depth-faces.wgsl?raw';
import edgeShaderSource from '../shaders/pyramid.wgsl?raw';
import vertexMarkerShaderSource from '../shaders/vertex-marker.wgsl?raw';
import type { OrbitalCameraController } from '../stereometry-camera-controller';
import {
  BACKGROUND_COLOR,
  EDGE_BRIGHTNESS_OVERRIDE_ID,
  EDGE_COUNT,
  EDGE_HIGHLIGHT_WIDTH_OVERRIDE_ID,
  EDGE_NORMAL_WIDTH_OVERRIDE_ID,
  FACE_DEPTH_BIAS,
  FACE_DEPTH_BIAS_SLOPE_SCALE,
  FACE_POSITION_FLOATS,
  FAR_PLANE,
  FIELD_OF_VIEW_RADIANS,
  HIDDEN_BRIGHTNESS,
  HIDDEN_HIGHLIGHT_LINE_WIDTH_PIXELS,
  HIDDEN_LINE_WIDTH_PIXELS,
  HIGHLIGHT_COLOR,
  HIGHLIGHT_LINE_WIDTH_PIXELS,
  LINE_EXTENSION_LENGTH,
  LINE_WIDTH_PIXELS,
  MARKER_BRIGHTNESS_OVERRIDE_ID,
  MSAA_SAMPLE_COUNT,
  NEAR_PLANE,
  VERTEX_MARKER_SIZE_PIXELS,
  VERTICES_PER_LINE_QUAD,
} from '../stereometry-constants';
import { createPentagonalPyramidWireframe } from '../stereometry-geometry';
import type { PyramidTopology, SelectionState } from '../stereometry-types';

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';
const MIN_DIMENSION = 1;

const FLOAT32_BYTES = 4;
const UINT32_BYTES = 4;

/** Per-edge instance: startPos(3) + endPos(3) = 6 floats */
const FLOATS_PER_EDGE_INSTANCE = 6;
const INSTANCE_STRIDE = FLOATS_PER_EDGE_INSTANCE * FLOAT32_BYTES;
const START_POS_OFFSET = 0;
const END_POS_OFFSET = 3 * FLOAT32_BYTES;

/** Highlight flag buffer: one u32 per edge instance */
const HIGHLIGHT_FLAG_STRIDE = UINT32_BYTES;

/** Vertex marker instance: position vec3 = 3 floats */
const MARKER_INSTANCE_FLOATS = 3;
const MARKER_INSTANCE_STRIDE = MARKER_INSTANCE_FLOATS * FLOAT32_BYTES;

/** Face vertex: position only (vec3) */
const FACE_VERTEX_STRIDE = FACE_POSITION_FLOATS * FLOAT32_BYTES;

/**
 * Uniform layout (std140):
 *   mvp:                mat4x4<f32> = 64 bytes (offset 0, align 16)
 *   viewport:           vec2<f32>   =  8 bytes (offset 64, align 8)
 *   lineWidth:          f32         =  4 bytes (offset 72, align 4)  [unused by edge shader]
 *   highlightLineWidth: f32         =  4 bytes (offset 76, align 4)  [unused by edge shader]
 *   highlightColor:     vec3<f32>   = 12 bytes (offset 80, align 16)
 *   vertexMarkerSize:   f32         =  4 bytes (offset 92, align 4)
 *   Total:                            96 bytes (multiple of 16)
 */
const UNIFORM_BUFFER_SIZE = 96;
const MVP_BYTE_OFFSET = 0;
const VIEWPORT_BYTE_OFFSET = 64;
const HIGHLIGHT_COLOR_BYTE_OFFSET = 80;
const VERTEX_MARKER_SIZE_BYTE_OFFSET = 92;

/** Number of vertices for a single marker quad (2 triangles) */
const VERTICES_PER_MARKER_QUAD = 6;

/** Number of marker instances when a vertex is selected */
const SINGLE_MARKER_INSTANCE = 1;

/**
 * Renders a pentagonal pyramid wireframe with hidden-edge dimming
 * and interactive selection highlighting.
 *
 * Multi-pass rendering within a single render pass:
 * 1. Depth faces -- fill depth buffer with solid face geometry (no color output)
 * 2. Hidden edges -- behind faces, alpha 0.7, thicker lines
 * 3. Visible edges -- in front of faces, opaque
 * 4. Hidden vertex marker -- behind faces, alpha 0.7 (conditional)
 * 5. Visible vertex marker -- in front of faces, opaque (conditional)
 */
export class PyramidLayer implements RenderLayer {
  private device!: GPUDevice;
  private format!: GPUTextureFormat;

  private depthFacesPipeline!: GPURenderPipeline;
  private visibleEdgePipeline!: GPURenderPipeline;
  private hiddenEdgePipeline!: GPURenderPipeline;
  private visibleMarkerPipeline!: GPURenderPipeline;
  private hiddenMarkerPipeline!: GPURenderPipeline;

  private bindGroup!: GPUBindGroup;
  private uniformBuffer!: GPUBuffer;
  private edgeInstanceBuffer!: GPUBuffer;
  private faceVertexBuffer!: GPUBuffer;
  private highlightFlagBuffer!: GPUBuffer;
  private vertexMarkerBuffer!: GPUBuffer;
  private lineInstanceBuffer!: GPUBuffer;
  private lineHighlightBuffer!: GPUBuffer;
  private edgeCount = 0;
  private faceVertexCount = 0;
  private depthTexture: GPUTexture | null = null;

  private lastMvpMatrix = new Float32Array(16);
  private hasVertexMarker = false;
  private extendedLineCount = 0;
  private extendedEdgeIndexList: number[] = [];
  private selectedEdgeIndex: number | null = null;

  constructor(
    private readonly camera: OrbitalCameraController,
    private readonly msaaManager: MsaaTextureManager,
    private readonly topology: PyramidTopology
  ) {}

  init(context: GpuContext): void {
    this.device = context.device;
    this.format = context.format;

    const wireframe = createPentagonalPyramidWireframe(this.topology);
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

    this.highlightFlagBuffer = this.device.createBuffer({
      size: EDGE_COUNT * UINT32_BYTES,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.vertexMarkerBuffer = this.device.createBuffer({
      size: MARKER_INSTANCE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.lineInstanceBuffer = this.device.createBuffer({
      size: EDGE_COUNT * INSTANCE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // All extended lines are always highlighted
    this.lineHighlightBuffer = this.device.createBuffer({
      size: EDGE_COUNT * UINT32_BYTES,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    const allHighlighted = new Uint32Array(EDGE_COUNT).fill(1);
    this.device.queue.writeBuffer(this.lineHighlightBuffer, 0, allHighlighted);

    this.uniformBuffer = this.device.createBuffer({
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(
      this.uniformBuffer,
      HIGHLIGHT_COLOR_BYTE_OFFSET,
      new Float32Array(HIGHLIGHT_COLOR)
    );
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      VERTEX_MARKER_SIZE_BYTE_OFFSET,
      new Float32Array([VERTEX_MARKER_SIZE_PIXELS])
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

    this.visibleEdgePipeline = this.createEdgePipeline(pipelineLayout, {
      depthCompare: 'less-equal',
      depthWriteEnabled: true,
      normalWidth: LINE_WIDTH_PIXELS,
      highlightWidth: HIGHLIGHT_LINE_WIDTH_PIXELS,
    });

    this.hiddenEdgePipeline = this.createEdgePipeline(pipelineLayout, {
      depthCompare: 'greater',
      depthWriteEnabled: false,
      normalWidth: HIDDEN_LINE_WIDTH_PIXELS,
      highlightWidth: HIDDEN_HIGHLIGHT_LINE_WIDTH_PIXELS,
      brightness: HIDDEN_BRIGHTNESS,
    });

    this.visibleMarkerPipeline = this.createVertexMarkerPipeline(pipelineLayout, {
      depthCompare: 'less-equal',
    });

    this.hiddenMarkerPipeline = this.createVertexMarkerPipeline(pipelineLayout, {
      depthCompare: 'greater',
      brightness: HIDDEN_BRIGHTNESS,
    });
  }

  update(state: FrameState): void {
    this.camera.tick();

    const viewMatrix = this.camera.getViewMatrix();
    const aspect = state.canvasWidth / Math.max(MIN_DIMENSION, state.canvasHeight);
    const projectionMatrix = mat4.perspective(FIELD_OF_VIEW_RADIANS, aspect, NEAR_PLANE, FAR_PLANE);
    const mvpMatrix = mat4.multiply(projectionMatrix, viewMatrix) as Float32Array;

    this.lastMvpMatrix.set(mvpMatrix);

    this.device.queue.writeBuffer(this.uniformBuffer, MVP_BYTE_OFFSET, mvpMatrix);
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

    // Pass 1: Fill depth buffer with solid faces (no color output)
    pass.setPipeline(this.depthFacesPipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.faceVertexBuffer);
    pass.draw(this.faceVertexCount);

    // Pass 2: Hidden edges (behind faces, dimmed, thicker)
    pass.setPipeline(this.hiddenEdgePipeline);
    pass.setVertexBuffer(0, this.edgeInstanceBuffer);
    pass.setVertexBuffer(1, this.highlightFlagBuffer);
    pass.draw(VERTICES_PER_LINE_QUAD, this.edgeCount);

    // Pass 2b: Hidden extended lines (persistent)
    if (this.extendedLineCount > 0) {
      pass.setVertexBuffer(0, this.lineInstanceBuffer);
      pass.setVertexBuffer(1, this.lineHighlightBuffer);
      pass.draw(VERTICES_PER_LINE_QUAD, this.extendedLineCount);
    }

    // Pass 3: Visible edges (in front of faces, opaque)
    pass.setPipeline(this.visibleEdgePipeline);
    pass.setVertexBuffer(0, this.edgeInstanceBuffer);
    pass.setVertexBuffer(1, this.highlightFlagBuffer);
    pass.draw(VERTICES_PER_LINE_QUAD, this.edgeCount);

    // Pass 3b: Visible extended lines (persistent)
    if (this.extendedLineCount > 0) {
      pass.setVertexBuffer(0, this.lineInstanceBuffer);
      pass.setVertexBuffer(1, this.lineHighlightBuffer);
      pass.draw(VERTICES_PER_LINE_QUAD, this.extendedLineCount);
    }

    // Pass 4-5: Vertex marker (conditional, hidden then visible)
    if (this.hasVertexMarker) {
      pass.setVertexBuffer(0, this.vertexMarkerBuffer);

      pass.setPipeline(this.hiddenMarkerPipeline);
      pass.draw(VERTICES_PER_MARKER_QUAD, SINGLE_MARKER_INSTANCE);

      pass.setPipeline(this.visibleMarkerPipeline);
      pass.draw(VERTICES_PER_MARKER_QUAD, SINGLE_MARKER_INSTANCE);
    }

    pass.end();
  }

  getLastMvpMatrix(): Float32Array {
    return this.lastMvpMatrix;
  }

  setSelection(selection: SelectionState): void {
    const highlightFlags = new Uint32Array(EDGE_COUNT);

    this.hasVertexMarker = false;
    this.selectedEdgeIndex = null;

    switch (selection.type) {
      case 'none': {
        break;
      }
      case 'edge': {
        this.selectedEdgeIndex = selection.edgeIndex;
        highlightFlags[selection.edgeIndex] = 1;
        break;
      }
      case 'vertex': {
        this.hasVertexMarker = true;
        const vertex = this.topology.vertices[selection.vertexIndex];
        this.device.queue.writeBuffer(this.vertexMarkerBuffer, 0, new Float32Array(vertex));
        break;
      }
    }

    this.device.queue.writeBuffer(this.highlightFlagBuffer, 0, highlightFlags);
    this.updateLineHighlights();
  }

  /**
   * Updates the set of persistent extended lines.
   * Each edge index in the set gets an infinite line drawn through it.
   */
  setExtendedLines(edgeIndices: ReadonlySet<number>): void {
    this.extendedEdgeIndexList = Array.from(edgeIndices);
    this.extendedLineCount = this.extendedEdgeIndexList.length;

    if (this.extendedLineCount === 0) {
      return;
    }

    const lineData = new Float32Array(this.extendedLineCount * FLOATS_PER_EDGE_INSTANCE);
    let lineOffset = 0;

    for (const edgeIndex of this.extendedEdgeIndexList) {
      const extendedLine = this.computeExtendedLine(edgeIndex);
      lineData.set(extendedLine, lineOffset);
      lineOffset += FLOATS_PER_EDGE_INSTANCE;
    }

    this.device.queue.writeBuffer(this.lineInstanceBuffer, 0, lineData);
    this.updateLineHighlights();
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.edgeInstanceBuffer.destroy();
    this.faceVertexBuffer.destroy();
    this.highlightFlagBuffer.destroy();
    this.vertexMarkerBuffer.destroy();
    this.lineInstanceBuffer.destroy();
    this.lineHighlightBuffer.destroy();
    this.depthTexture?.destroy();
  }

  /**
   * Updates highlight flags for extended lines based on current selection.
   * Only the line matching the selected edge is highlighted; others use normal style.
   */
  private updateLineHighlights(): void {
    if (this.extendedLineCount === 0) {
      return;
    }

    const flags = new Uint32Array(this.extendedLineCount);
    for (let index = 0; index < this.extendedLineCount; index++) {
      flags[index] = this.extendedEdgeIndexList[index] === this.selectedEdgeIndex ? 1 : 0;
    }

    this.device.queue.writeBuffer(this.lineHighlightBuffer, 0, flags);
  }

  /**
   * Computes extended line endpoints through the given edge.
   * The line extends LINE_EXTENSION_LENGTH in both directions.
   */
  private computeExtendedLine(edgeIndex: number): Float32Array {
    const [vertexIndexA, vertexIndexB] = this.topology.edges[edgeIndex];
    const positionA = this.topology.vertices[vertexIndexA];
    const positionB = this.topology.vertices[vertexIndexB];

    const directionX = positionB[0] - positionA[0];
    const directionY = positionB[1] - positionA[1];
    const directionZ = positionB[2] - positionA[2];
    const edgeLength = Math.sqrt(
      directionX * directionX + directionY * directionY + directionZ * directionZ
    );

    const normalizedX = directionX / edgeLength;
    const normalizedY = directionY / edgeLength;
    const normalizedZ = directionZ / edgeLength;

    return new Float32Array([
      positionA[0] - normalizedX * LINE_EXTENSION_LENGTH,
      positionA[1] - normalizedY * LINE_EXTENSION_LENGTH,
      positionA[2] - normalizedZ * LINE_EXTENSION_LENGTH,
      positionB[0] + normalizedX * LINE_EXTENSION_LENGTH,
      positionB[1] + normalizedY * LINE_EXTENSION_LENGTH,
      positionB[2] + normalizedZ * LINE_EXTENSION_LENGTH,
    ]);
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
    options: {
      depthCompare: GPUCompareFunction;
      depthWriteEnabled: boolean;
      normalWidth: number;
      highlightWidth: number;
      brightness?: number;
    }
  ): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({ code: edgeShaderSource });

    return this.device.createRenderPipeline({
      layout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        constants: {
          [EDGE_NORMAL_WIDTH_OVERRIDE_ID]: options.normalWidth,
          [EDGE_HIGHLIGHT_WIDTH_OVERRIDE_ID]: options.highlightWidth,
        },
        buffers: [
          {
            arrayStride: INSTANCE_STRIDE,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 0, offset: START_POS_OFFSET, format: 'float32x3' },
              { shaderLocation: 1, offset: END_POS_OFFSET, format: 'float32x3' },
            ],
          },
          {
            arrayStride: HIGHLIGHT_FLAG_STRIDE,
            stepMode: 'instance',
            attributes: [{ shaderLocation: 2, offset: 0, format: 'uint32' }],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [{ format: this.format }],
        constants: {
          [EDGE_BRIGHTNESS_OVERRIDE_ID]: options.brightness ?? 1.0,
        },
      },
      primitive: {
        topology: 'triangle-list',
      },
      depthStencil: {
        depthWriteEnabled: options.depthWriteEnabled,
        depthCompare: options.depthCompare,
        format: DEPTH_FORMAT,
      },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });
  }

  private createVertexMarkerPipeline(
    layout: GPUPipelineLayout,
    options: {
      depthCompare: GPUCompareFunction;
      brightness?: number;
    }
  ): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({ code: vertexMarkerShaderSource });

    return this.device.createRenderPipeline({
      layout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: MARKER_INSTANCE_STRIDE,
            stepMode: 'instance',
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [
          {
            format: this.format,
          },
        ],
        constants: {
          [MARKER_BRIGHTNESS_OVERRIDE_ID]: options.brightness ?? 1.0,
        },
      },
      primitive: {
        topology: 'triangle-list',
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: options.depthCompare,
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
