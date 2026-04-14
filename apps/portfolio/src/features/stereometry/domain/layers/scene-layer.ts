import type { FrameState, GpuContext, MsaaTextureManager, RenderLayer } from '@frozik/utils';
import { isNil } from 'lodash-es';
import { mat4, vec4 } from 'wgpu-matrix';
import type { OrbitalCameraController } from '../camera-controller';
import {
  DEPTH_FADE_MIN,
  DEPTH_FADE_RATE,
  FACE_DEPTH_BIAS,
  FACE_DEPTH_BIAS_SLOPE_SCALE,
  FACE_POSITION_FLOATS,
  FAR_PLANE,
  HOMOGENEOUS_W,
  MSAA_SAMPLE_COUNT,
  NEAR_PLANE,
  ORTHO_SCALE,
  STEREOMETRY_STYLES,
  VERTICES_PER_LINE_QUAD,
} from '../constants';
import type { DragPreviewState } from '../drag-connector';
import type { FpsController } from '../fps-controller';
import { EFpsLevel } from '../fps-controller';
import { createWireframeFromTopology } from '../geometry';
import commonShaderSource from '../shaders/common.wgsl?raw';
import depthFacesSpecificSource from '../shaders/depth-faces.wgsl?raw';
import lineSpecificSource from '../shaders/line.wgsl?raw';
import vertexMarkerSpecificSource from '../shaders/vertex-marker.wgsl?raw';

const depthFacesShaderSource = commonShaderSource + depthFacesSpecificSource;
const lineShaderSource = commonShaderSource + lineSpecificSource;
const vertexMarkerShaderSource = commonShaderSource + vertexMarkerSpecificSource;

import { hexToRgb, resolveStyle } from '../styles-processor';
import type { FigureTopology, SceneState, SelectionState, StyledSegment } from '../types';
import { processVertexMarkers } from '../vertex-processor';

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';
const MIN_DIMENSION = 1;

const FLOAT32_BYTES = 4;

/** Number of floats per styled line instance (32 = 128 bytes, matching shader LineInstance layout) */
const FLOATS_PER_STYLED_LINE = 32;
const STYLED_LINE_STRIDE = FLOATS_PER_STYLED_LINE * FLOAT32_BYTES;

/** Pipeline-overridable constant ID for the useHiddenStyle flag in line.wgsl */
const USE_HIDDEN_STYLE_OVERRIDE_ID = 0;

/** Vertex marker instance: position(3) + type(1) + visibleStyle(9) + hiddenStyle(9) + reserved(2) = 24 floats */
const MARKER_INSTANCE_FLOATS = 24;
const MARKER_INSTANCE_STRIDE = MARKER_INSTANCE_FLOATS * FLOAT32_BYTES;

/** Face vertex: position only (vec3) */
const FACE_VERTEX_STRIDE = FACE_POSITION_FLOATS * FLOAT32_BYTES;

/**
 * Uniform layout (std140):
 *   mvp:              mat4x4<f32> = 64 bytes (offset 0, align 16)
 *   viewport:         vec2<f32>   =  8 bytes (offset 64, align 8)
 *   dpr:              f32         =  4 bytes (offset 72, align 4)
 *   cameraDistance:    f32         =  4 bytes (offset 76, align 4)
 *   cameraForward:    vec3<f32>   = 12 bytes (offset 80, align 16)
 *   cameraTarget:     vec3<f32>   = 12 bytes (offset 96, align 16)
 *   depthFadeRate:    f32         =  4 bytes (offset 108, align 4)
 *   depthFadeMin:     f32         =  4 bytes (offset 112, align 4)
 *   Total:                         116 bytes → 128 (padded to multiple of 16)
 */
const UNIFORM_BUFFER_SIZE = 128;
const MVP_BYTE_OFFSET = 0;
const VIEWPORT_BYTE_OFFSET = 64;
const DPR_BYTE_OFFSET = 72;
const CAMERA_FORWARD_BYTE_OFFSET = 80;
const DEPTH_FADE_BYTE_OFFSET = 108;
const CAMERA_TARGET_BYTE_OFFSET = 96;

/** Number of vertices for a single marker quad (2 triangles) */
const VERTICES_PER_MARKER_QUAD = 6;

/**
 * Renders a stereometry scene with hidden-edge dimming
 * and interactive selection highlighting.
 *
 * Two-pass rendering:
 *
 * Depth pre-pass (non-MSAA, no color):
 *   Renders solid faces into a non-MSAA depth texture for marker sampling.
 *
 * Main render pass (MSAA):
 *   1. Depth faces -- fill MSAA depth buffer (no color output)
 *   2. Hidden styled lines -- behind faces, per-instance hidden style
 *   3. Visible styled lines -- in front of faces, per-instance visible style
 *   4. Preview line -- always visible (drag-to-connect)
 *   5. Vertex markers -- GPU-based binary occlusion via depth texture sampling
 *   6. Preview start marker -- always visible
 *   7. Preview snap marker -- always visible
 */
export class SceneLayer implements RenderLayer {
  private device!: GPUDevice;
  private format!: GPUTextureFormat;

  private depthFacesPipeline!: GPURenderPipeline;
  private visibleLinePipeline!: GPURenderPipeline;
  private hiddenLinePipeline!: GPURenderPipeline;
  private previewLinePipeline!: GPURenderPipeline;
  private markerPipeline!: GPURenderPipeline;

  private bindGroup!: GPUBindGroup;
  private previewBindGroup!: GPUBindGroup;
  private markerBindGroup!: GPUBindGroup;
  private previewMarkerBindGroup!: GPUBindGroup;
  private markerBindGroupLayout!: GPUBindGroupLayout;
  private uniformBuffer!: GPUBuffer;
  private previewUniformBuffer!: GPUBuffer;
  private faceVertexBuffer!: GPUBuffer;
  private styledLineBuffer!: GPUBuffer;
  private topologyVertexMarkerBuffer!: GPUBuffer;
  private previewLineBuffer!: GPUBuffer;
  private previewStartMarkerBuffer!: GPUBuffer;
  private previewSnapMarkerBuffer!: GPUBuffer;
  private depthPrePassPipeline!: GPURenderPipeline;
  private depthSampler!: GPUSampler;
  private faceVertexCount = 0;
  private depthTexture: GPUTexture | null = null;
  private samplingDepthTexture: GPUTexture | null = null;

  private lastMvpMatrix = new Float32Array(16);
  private styledLineCount = 0;
  private topologyVertexCount = 0;
  private hasDragPreview = false;
  private hasSnapTarget = false;
  private lastCanvasWidth = 0;
  private lastCanvasHeight = 0;
  private lastDevicePixelRatio = 1;
  private readonly backgroundClearColor: GPUColor;
  private readonly vertexPreviewStyle: {
    markerType: number;
    size: number;
    color: readonly [number, number, number];
    alpha: number;
    strokeColor: readonly [number, number, number];
    strokeWidth: number;
  };

  constructor(
    private readonly camera: OrbitalCameraController,
    private readonly msaaManager: MsaaTextureManager,
    private readonly topology: FigureTopology,
    private readonly fpsController: FpsController
  ) {
    const backgroundStyle = resolveStyle(STEREOMETRY_STYLES, 'background', []);
    const [bgR, bgG, bgB] = hexToRgb(backgroundStyle.color);
    this.backgroundClearColor = { r: bgR, g: bgG, b: bgB, a: 1.0 };

    const resolvedPreview = resolveStyle(STEREOMETRY_STYLES, 'vertex', ['preview']);
    this.vertexPreviewStyle = {
      markerType: resolvedPreview.markerType === 'circle' ? 1 : 0,
      size: resolvedPreview.size,
      color: hexToRgb(resolvedPreview.color),
      alpha: resolvedPreview.alpha,
      strokeColor: hexToRgb(resolvedPreview.strokeColor),
      strokeWidth: resolvedPreview.strokeWidth,
    };
  }

  init(context: GpuContext): void {
    this.device = context.device;
    this.format = context.format;

    const wireframe = createWireframeFromTopology(this.topology);
    this.faceVertexCount = wireframe.faceVertexCount;

    this.faceVertexBuffer = this.createAndWriteBuffer(
      wireframe.facePositions,
      GPUBufferUsage.VERTEX
    );

    // Max segments: topology edges + user lines split by intersections
    const maxIntersections = (this.topology.edges.length * (this.topology.edges.length - 1)) / 2;
    const maxStyledSegments = Math.max(1, this.topology.edges.length + maxIntersections);

    this.styledLineBuffer = this.device.createBuffer({
      size: Math.max(STYLED_LINE_STRIDE, maxStyledSegments * STYLED_LINE_STRIDE),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Vertex markers: topology vertices + potential intersection vertices
    const maxVertexCount = this.topology.vertices.length + maxIntersections;
    this.topologyVertexMarkerBuffer = this.device.createBuffer({
      size: maxVertexCount * MARKER_INSTANCE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Preview line buffer (single styled line instance)
    this.previewLineBuffer = this.device.createBuffer({
      size: STYLED_LINE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Preview marker buffers (single marker instance each)
    this.previewStartMarkerBuffer = this.device.createBuffer({
      size: MARKER_INSTANCE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.previewSnapMarkerBuffer = this.device.createBuffer({
      size: MARKER_INSTANCE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.uniformBuffer = this.device.createBuffer({
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Preview uniform buffer (shares same layout, used for preview lines)
    this.previewUniformBuffer = this.device.createBuffer({
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Write depth fade parameters (constant, same for both buffers)
    const depthFadeData = new Float32Array([DEPTH_FADE_RATE, DEPTH_FADE_MIN]);
    this.device.queue.writeBuffer(this.uniformBuffer, DEPTH_FADE_BYTE_OFFSET, depthFadeData);
    this.device.queue.writeBuffer(this.previewUniformBuffer, DEPTH_FADE_BYTE_OFFSET, depthFadeData);

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

    this.previewBindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.previewUniformBuffer } }],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    this.depthFacesPipeline = this.createDepthFacesPipeline(pipelineLayout);
    this.depthPrePassPipeline = this.createDepthPrePassPipeline(pipelineLayout);

    this.visibleLinePipeline = this.createStyledLinePipeline(pipelineLayout, {
      depthCompare: 'less-equal',
      depthWriteEnabled: true,
      useHiddenStyle: false,
    });

    this.hiddenLinePipeline = this.createStyledLinePipeline(pipelineLayout, {
      depthCompare: 'greater',
      depthWriteEnabled: false,
      useHiddenStyle: true,
    });

    this.previewLinePipeline = this.createStyledLinePipeline(pipelineLayout, {
      depthCompare: 'always',
      depthWriteEnabled: false,
      useHiddenStyle: false,
    });

    // Marker bind group layout: uniform buffer + depth texture + depth sampler
    this.markerBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          texture: { sampleType: 'depth' },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX,
          sampler: { type: 'non-filtering' },
        },
      ],
    });

    this.depthSampler = this.device.createSampler({
      minFilter: 'nearest',
      magFilter: 'nearest',
    });

    const markerPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.markerBindGroupLayout],
    });

    this.markerPipeline = this.createMarkerPipeline(markerPipelineLayout);
  }

  update(state: FrameState): void {
    const isAnimating = this.camera.tick();
    if (isAnimating) {
      this.fpsController.raise(EFpsLevel.Animation);
    }

    const viewMatrix = this.camera.getViewMatrix();
    const cameraDistance = this.camera.getDistance();
    const aspect = state.canvasWidth / Math.max(MIN_DIMENSION, state.canvasHeight);
    const halfHeight = cameraDistance * ORTHO_SCALE;
    const halfWidth = halfHeight * aspect;
    const projectionMatrix = mat4.ortho(
      -halfWidth,
      halfWidth,
      -halfHeight,
      halfHeight,
      NEAR_PLANE,
      FAR_PLANE
    );
    const mvpMatrix = mat4.multiply(projectionMatrix, viewMatrix) as Float32Array;

    this.lastMvpMatrix.set(mvpMatrix);
    this.lastCanvasWidth = state.canvasWidth;
    this.lastCanvasHeight = state.canvasHeight;
    this.lastDevicePixelRatio = state.devicePixelRatio;

    // Camera forward direction (from view matrix, negative Z axis)
    const cameraForward = new Float32Array([-viewMatrix[2], -viewMatrix[6], -viewMatrix[10]]);

    this.device.queue.writeBuffer(this.uniformBuffer, MVP_BYTE_OFFSET, mvpMatrix);
    const viewportData = new Float32Array([state.canvasWidth, state.canvasHeight]);
    this.device.queue.writeBuffer(this.uniformBuffer, VIEWPORT_BYTE_OFFSET, viewportData);
    const cameraData = new Float32Array([state.devicePixelRatio, cameraDistance]);
    this.device.queue.writeBuffer(this.uniformBuffer, DPR_BYTE_OFFSET, cameraData);
    this.device.queue.writeBuffer(this.uniformBuffer, CAMERA_FORWARD_BYTE_OFFSET, cameraForward);
    const cameraTarget = new Float32Array([0, 0, 0]);
    this.device.queue.writeBuffer(this.uniformBuffer, CAMERA_TARGET_BYTE_OFFSET, cameraTarget);

    // Keep preview uniform buffer in sync
    this.device.queue.writeBuffer(this.previewUniformBuffer, MVP_BYTE_OFFSET, mvpMatrix);
    this.device.queue.writeBuffer(this.previewUniformBuffer, VIEWPORT_BYTE_OFFSET, viewportData);
    this.device.queue.writeBuffer(this.previewUniformBuffer, DPR_BYTE_OFFSET, cameraData);
    this.device.queue.writeBuffer(
      this.previewUniformBuffer,
      CAMERA_FORWARD_BYTE_OFFSET,
      cameraForward
    );
    this.device.queue.writeBuffer(
      this.previewUniformBuffer,
      CAMERA_TARGET_BYTE_OFFSET,
      cameraTarget
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
    const currentSamplingDepthView = this.ensureSamplingDepthTexture(
      state.canvasWidth,
      state.canvasHeight
    );

    // Depth pre-pass: render faces into non-MSAA depth texture for marker sampling
    const depthPrePass = encoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: currentSamplingDepthView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    depthPrePass.setPipeline(this.depthPrePassPipeline);
    depthPrePass.setBindGroup(0, this.bindGroup);
    depthPrePass.setVertexBuffer(0, this.faceVertexBuffer);
    depthPrePass.draw(this.faceVertexCount);
    depthPrePass.end();

    // Main render pass: faces (depth fill) + lines + markers
    const mainPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: currentMsaaView,
          resolveTarget: canvasView,
          loadOp: 'clear',
          clearValue: this.backgroundClearColor,
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

    // Fill depth buffer with solid faces (no color output, determines hidden/visible lines)
    mainPass.setPipeline(this.depthFacesPipeline);
    mainPass.setBindGroup(0, this.bindGroup);
    mainPass.setVertexBuffer(0, this.faceVertexBuffer);
    mainPass.draw(this.faceVertexCount);

    // Hidden styled lines (behind faces, per-instance hidden style)
    if (this.styledLineCount > 0) {
      mainPass.setPipeline(this.hiddenLinePipeline);
      mainPass.setBindGroup(0, this.bindGroup);
      mainPass.setVertexBuffer(0, this.styledLineBuffer);
      mainPass.draw(VERTICES_PER_LINE_QUAD, this.styledLineCount);
    }

    // Visible styled lines (in front of faces, per-instance visible style)
    if (this.styledLineCount > 0) {
      mainPass.setPipeline(this.visibleLinePipeline);
      mainPass.setBindGroup(0, this.bindGroup);
      mainPass.setVertexBuffer(0, this.styledLineBuffer);
      mainPass.draw(VERTICES_PER_LINE_QUAD, this.styledLineCount);
    }

    // Preview line (always visible)
    if (this.hasDragPreview) {
      mainPass.setPipeline(this.previewLinePipeline);
      mainPass.setBindGroup(0, this.previewBindGroup);
      mainPass.setVertexBuffer(0, this.previewLineBuffer);
      mainPass.draw(VERTICES_PER_LINE_QUAD, 1);
    }

    // Vertex markers (depth-sampled occlusion via sampling depth texture)
    if (this.topologyVertexCount > 0) {
      mainPass.setPipeline(this.markerPipeline);
      mainPass.setBindGroup(0, this.markerBindGroup);
      mainPass.setVertexBuffer(0, this.topologyVertexMarkerBuffer);
      mainPass.draw(VERTICES_PER_MARKER_QUAD, this.topologyVertexCount);
    }

    // Preview start marker
    if (this.hasDragPreview) {
      mainPass.setPipeline(this.markerPipeline);
      mainPass.setBindGroup(0, this.previewMarkerBindGroup);
      mainPass.setVertexBuffer(0, this.previewStartMarkerBuffer);
      mainPass.draw(VERTICES_PER_MARKER_QUAD, 1);
    }

    // Preview snap target marker
    if (this.hasSnapTarget) {
      mainPass.setPipeline(this.markerPipeline);
      mainPass.setBindGroup(0, this.previewMarkerBindGroup);
      mainPass.setVertexBuffer(0, this.previewSnapMarkerBuffer);
      mainPass.draw(VERTICES_PER_MARKER_QUAD, 1);
    }

    mainPass.end();
  }

  getLastMvpMatrix(): Float32Array {
    return this.lastMvpMatrix;
  }

  /**
   * Updates the drag-to-connect preview state.
   * When preview is defined, computes the end 3D position and writes preview buffers.
   * When undefined, clears the preview.
   */
  setDragPreview(preview: DragPreviewState | undefined): void {
    if (isNil(preview)) {
      this.hasDragPreview = false;
      this.hasSnapTarget = false;
      return;
    }

    const endPosition = !isNil(preview.snapTargetPosition)
      ? preview.snapTargetPosition
      : this.unprojectToVertexPlane(
          preview.cursorScreenX,
          preview.cursorScreenY,
          preview.startPosition
        );

    const previewSegmentStyle = resolveStyle(STEREOMETRY_STYLES, 'line', ['preview', 'segment']);
    const [colorR, colorG, colorB] = hexToRgb(previewSegmentStyle.color);

    // Write a single styled line instance for the preview
    const instanceData = new Float32Array(FLOATS_PER_STYLED_LINE);
    instanceData[0] = preview.startPosition[0];
    instanceData[1] = preview.startPosition[1];
    instanceData[2] = preview.startPosition[2];
    instanceData[3] = endPosition[0];
    instanceData[4] = endPosition[1];
    instanceData[5] = endPosition[2];
    instanceData[6] = previewSegmentStyle.width;
    instanceData[7] = colorR;
    instanceData[8] = colorG;
    instanceData[9] = colorB;
    instanceData[10] = previewSegmentStyle.alpha;
    // visibleLineType, visibleDash, visibleGap = 0 (solid)

    this.device.queue.writeBuffer(this.previewLineBuffer, 0, instanceData);

    this.hasDragPreview = true;

    this.device.queue.writeBuffer(
      this.previewStartMarkerBuffer,
      0,
      this.createPreviewMarkerData(preview.startPosition)
    );

    if (!isNil(preview.snapTargetPosition)) {
      this.device.queue.writeBuffer(
        this.previewSnapMarkerBuffer,
        0,
        this.createPreviewMarkerData(preview.snapTargetPosition)
      );
      this.hasSnapTarget = true;
    } else {
      this.hasSnapTarget = false;
    }
  }

  /**
   * Applies the full scene state and styled segments to GPU buffers.
   */
  applySceneState(
    scene: SceneState,
    segments: readonly StyledSegment[],
    selection: SelectionState
  ): void {
    this.applyStyledMarkers(scene, selection);
    this.applyStyledSegments(segments);
  }

  private applyStyledMarkers(scene: SceneState, selection: SelectionState): void {
    const vertexPositions = scene.vertices.map(vertex => vertex.position);
    const styledMarkers = processVertexMarkers(
      this.topology,
      vertexPositions,
      selection,
      scene.lines
    );

    this.topologyVertexCount = styledMarkers.length;

    if (this.topologyVertexCount === 0) {
      return;
    }

    const markerData = new Float32Array(styledMarkers.length * MARKER_INSTANCE_FLOATS);

    for (let index = 0; index < styledMarkers.length; index++) {
      const marker = styledMarkers[index];
      const offset = index * MARKER_INSTANCE_FLOATS;

      // Position + type
      markerData[offset] = marker.position[0];
      markerData[offset + 1] = marker.position[1];
      markerData[offset + 2] = marker.position[2];
      markerData[offset + 3] = marker.markerType;

      // Visible style
      markerData[offset + 4] = marker.visibleStyle.size;
      markerData[offset + 5] = marker.visibleStyle.color[0];
      markerData[offset + 6] = marker.visibleStyle.color[1];
      markerData[offset + 7] = marker.visibleStyle.color[2];
      markerData[offset + 8] = marker.visibleStyle.alpha;
      markerData[offset + 9] = marker.visibleStyle.strokeColor[0];
      markerData[offset + 10] = marker.visibleStyle.strokeColor[1];
      markerData[offset + 11] = marker.visibleStyle.strokeColor[2];
      markerData[offset + 12] = marker.visibleStyle.strokeWidth;

      // Hidden style
      markerData[offset + 13] = marker.hiddenStyle.size;
      markerData[offset + 14] = marker.hiddenStyle.color[0];
      markerData[offset + 15] = marker.hiddenStyle.color[1];
      markerData[offset + 16] = marker.hiddenStyle.color[2];
      markerData[offset + 17] = marker.hiddenStyle.alpha;
      markerData[offset + 18] = marker.hiddenStyle.strokeColor[0];
      markerData[offset + 19] = marker.hiddenStyle.strokeColor[1];
      markerData[offset + 20] = marker.hiddenStyle.strokeColor[2];
      markerData[offset + 21] = marker.hiddenStyle.strokeWidth;

      // Floats 13-15 are reserved (remain 0)
    }

    this.device.queue.writeBuffer(this.topologyVertexMarkerBuffer, 0, markerData);
  }

  /**
   * Writes all styled segments into the unified GPU buffer.
   * Each segment is 32 floats (128 bytes) matching the shader LineInstance layout.
   */
  private applyStyledSegments(segments: readonly StyledSegment[]): void {
    this.styledLineCount = segments.length;

    if (this.styledLineCount === 0) {
      return;
    }

    const instanceData = new Float32Array(this.styledLineCount * FLOATS_PER_STYLED_LINE);

    for (let index = 0; index < this.styledLineCount; index++) {
      const segment = segments[index];
      const offset = index * FLOATS_PER_STYLED_LINE;

      // Positions
      instanceData[offset] = segment.startPosition[0];
      instanceData[offset + 1] = segment.startPosition[1];
      instanceData[offset + 2] = segment.startPosition[2];
      instanceData[offset + 3] = segment.endPosition[0];
      instanceData[offset + 4] = segment.endPosition[1];
      instanceData[offset + 5] = segment.endPosition[2];

      // Visible style
      instanceData[offset + 6] = segment.visibleStyle.width;
      instanceData[offset + 7] = segment.visibleStyle.color[0];
      instanceData[offset + 8] = segment.visibleStyle.color[1];
      instanceData[offset + 9] = segment.visibleStyle.color[2];
      instanceData[offset + 10] = segment.visibleStyle.alpha;
      instanceData[offset + 11] = segment.visibleStyle.lineType;
      instanceData[offset + 12] = segment.visibleStyle.dash;
      instanceData[offset + 13] = segment.visibleStyle.gap;

      // Hidden style
      instanceData[offset + 14] = segment.hiddenStyle.width;
      instanceData[offset + 15] = segment.hiddenStyle.color[0];
      instanceData[offset + 16] = segment.hiddenStyle.color[1];
      instanceData[offset + 17] = segment.hiddenStyle.color[2];
      instanceData[offset + 18] = segment.hiddenStyle.alpha;
      instanceData[offset + 19] = segment.hiddenStyle.lineType;
      instanceData[offset + 20] = segment.hiddenStyle.dash;
      instanceData[offset + 21] = segment.hiddenStyle.gap;

      // Floats 22-31 are reserved (remain 0)
    }

    this.device.queue.writeBuffer(this.styledLineBuffer, 0, instanceData);
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.previewUniformBuffer.destroy();
    this.faceVertexBuffer.destroy();
    this.styledLineBuffer.destroy();
    this.topologyVertexMarkerBuffer.destroy();
    this.previewLineBuffer.destroy();
    this.previewStartMarkerBuffer.destroy();
    this.previewSnapMarkerBuffer.destroy();
    this.depthTexture?.destroy();
    this.samplingDepthTexture?.destroy();
  }

  /**
   * Unprojects a screen-space position to a 3D point on the plane through
   * the reference position, perpendicular to the view direction.
   * Uses the reference position's clip-space Z to determine the depth.
   */
  private unprojectToVertexPlane(
    screenX: number,
    screenY: number,
    referencePosition: readonly [number, number, number]
  ): readonly [number, number, number] {
    const canvasWidth = this.lastCanvasWidth;
    const canvasHeight = this.lastCanvasHeight;
    const devicePixelRatio = this.lastDevicePixelRatio;

    // Convert CSS screen coords to NDC
    const pixelX = screenX * devicePixelRatio;
    const pixelY = screenY * devicePixelRatio;
    const ndcX = (pixelX / canvasWidth) * 2 - 1;
    const ndcY = 1 - (pixelY / canvasHeight) * 2;

    // Get reference position's clip-space Z for depth
    const refClip = vec4.transformMat4(
      vec4.fromValues(
        referencePosition[0],
        referencePosition[1],
        referencePosition[2],
        HOMOGENEOUS_W
      ),
      this.lastMvpMatrix
    );
    const refNdcZ = refClip[2] / refClip[3];

    // Unproject using inverse MVP
    const inverseMvp = mat4.inverse(this.lastMvpMatrix);
    const worldPoint = vec4.transformMat4(
      vec4.fromValues(ndcX, ndcY, refNdcZ, HOMOGENEOUS_W),
      inverseMvp
    );

    return [
      worldPoint[0] / worldPoint[3],
      worldPoint[1] / worldPoint[3],
      worldPoint[2] / worldPoint[3],
    ];
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

  private createStyledLinePipeline(
    layout: GPUPipelineLayout,
    options: {
      depthCompare: GPUCompareFunction;
      depthWriteEnabled: boolean;
      useHiddenStyle: boolean;
    }
  ): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({ code: lineShaderSource });
    return this.device.createRenderPipeline({
      layout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        constants: {
          [USE_HIDDEN_STYLE_OVERRIDE_ID]: options.useHiddenStyle ? 1.0 : 0.0,
        },
        buffers: [
          {
            arrayStride: STYLED_LINE_STRIDE,
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' }, // startPos
              { shaderLocation: 1, offset: 12, format: 'float32x3' }, // endPos
              { shaderLocation: 2, offset: 24, format: 'float32' }, // visibleWidth
              { shaderLocation: 3, offset: 28, format: 'float32x3' }, // visibleColor
              { shaderLocation: 4, offset: 40, format: 'float32' }, // visibleAlpha
              { shaderLocation: 5, offset: 44, format: 'float32' }, // visibleLineType
              { shaderLocation: 6, offset: 48, format: 'float32' }, // visibleDash
              { shaderLocation: 7, offset: 52, format: 'float32' }, // visibleGap
              { shaderLocation: 8, offset: 56, format: 'float32' }, // hiddenWidth
              { shaderLocation: 9, offset: 60, format: 'float32x3' }, // hiddenColor
              { shaderLocation: 10, offset: 72, format: 'float32' }, // hiddenAlpha
              { shaderLocation: 11, offset: 76, format: 'float32' }, // hiddenLineType
              { shaderLocation: 12, offset: 80, format: 'float32' }, // hiddenDash
              { shaderLocation: 13, offset: 84, format: 'float32' }, // hiddenGap
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
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

  private createDepthPrePassPipeline(layout: GPUPipelineLayout): GPURenderPipeline {
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
    });
  }

  private createMarkerPipeline(layout: GPUPipelineLayout): GPURenderPipeline {
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
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
              { shaderLocation: 1, offset: 12, format: 'float32' }, // markerType
              { shaderLocation: 2, offset: 16, format: 'float32' }, // visibleSize
              { shaderLocation: 3, offset: 20, format: 'float32x3' }, // visibleColor
              { shaderLocation: 4, offset: 32, format: 'float32' }, // visibleAlpha
              { shaderLocation: 5, offset: 36, format: 'float32x3' }, // visibleStrokeColor
              { shaderLocation: 6, offset: 48, format: 'float32' }, // visibleStrokeWidth
              { shaderLocation: 7, offset: 52, format: 'float32' }, // hiddenSize
              { shaderLocation: 8, offset: 56, format: 'float32x3' }, // hiddenColor
              { shaderLocation: 9, offset: 68, format: 'float32' }, // hiddenAlpha
              { shaderLocation: 10, offset: 72, format: 'float32x3' }, // hiddenStrokeColor
              { shaderLocation: 11, offset: 84, format: 'float32' }, // hiddenStrokeWidth
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: 'always',
        format: DEPTH_FORMAT,
      },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });
  }

  /**
   * Creates a 16-float marker instance for preview markers.
   * Uses the preview style for both visible and hidden fields since
   * preview markers render with depthCompare: 'always'.
   */
  private createPreviewMarkerData(position: readonly [number, number, number]): Float32Array {
    const markerData = new Float32Array(MARKER_INSTANCE_FLOATS);

    const style = this.vertexPreviewStyle;

    // Position + type
    markerData[0] = position[0];
    markerData[1] = position[1];
    markerData[2] = position[2];
    markerData[3] = style.markerType;

    // Visible style
    markerData[4] = style.size;
    markerData[5] = style.color[0];
    markerData[6] = style.color[1];
    markerData[7] = style.color[2];
    markerData[8] = style.alpha;
    markerData[9] = style.strokeColor[0];
    markerData[10] = style.strokeColor[1];
    markerData[11] = style.strokeColor[2];
    markerData[12] = style.strokeWidth;

    // Hidden style (same as visible for preview — always visible via depth sampling)
    markerData[13] = style.size;
    markerData[14] = style.color[0];
    markerData[15] = style.color[1];
    markerData[16] = style.color[2];
    markerData[17] = style.alpha;
    markerData[18] = style.strokeColor[0];
    markerData[19] = style.strokeColor[1];
    markerData[20] = style.strokeColor[2];
    markerData[21] = style.strokeWidth;

    // Floats 22-23 are reserved (remain 0)

    return markerData;
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

  /**
   * Ensures a non-MSAA depth texture exists for sampling in marker shaders.
   * Recreates marker bind groups when the texture changes size.
   */
  private ensureSamplingDepthTexture(width: number, height: number): GPUTextureView {
    const safeWidth = Math.max(MIN_DIMENSION, width);
    const safeHeight = Math.max(MIN_DIMENSION, height);

    if (
      !isNil(this.samplingDepthTexture) &&
      this.samplingDepthTexture.width === safeWidth &&
      this.samplingDepthTexture.height === safeHeight
    ) {
      return this.samplingDepthTexture.createView();
    }

    this.samplingDepthTexture?.destroy();

    this.samplingDepthTexture = this.device.createTexture({
      size: [safeWidth, safeHeight],
      format: DEPTH_FORMAT,
      sampleCount: 1,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    const depthTextureView = this.samplingDepthTexture.createView();

    this.markerBindGroup = this.device.createBindGroup({
      layout: this.markerBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: depthTextureView },
        { binding: 2, resource: this.depthSampler },
      ],
    });

    this.previewMarkerBindGroup = this.device.createBindGroup({
      layout: this.markerBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.previewUniformBuffer } },
        { binding: 1, resource: depthTextureView },
        { binding: 2, resource: this.depthSampler },
      ],
    });

    return this.samplingDepthTexture.createView();
  }
}
