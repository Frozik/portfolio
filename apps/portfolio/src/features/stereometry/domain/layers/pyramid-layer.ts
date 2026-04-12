import type { FrameState, GpuContext, MsaaTextureManager, RenderLayer } from '@frozik/utils';
import { assertNever } from '@frozik/utils';
import { isNil } from 'lodash-es';
import { mat4, vec4 } from 'wgpu-matrix';

import depthFacesShaderSource from '../shaders/depth-faces.wgsl?raw';
import edgeShaderSource from '../shaders/pyramid.wgsl?raw';
import vertexMarkerShaderSource from '../shaders/vertex-marker.wgsl?raw';
import type { OrbitalCameraController } from '../stereometry-camera-controller';
import {
  BACKGROUND_COLOR,
  DRAG_PREVIEW_COLOR,
  EDGE_BRIGHTNESS_OVERRIDE_ID,
  EDGE_DASH_LENGTH_OVERRIDE_ID,
  EDGE_GAP_LENGTH_OVERRIDE_ID,
  EDGE_HIGHLIGHT_WIDTH_OVERRIDE_ID,
  EDGE_NORMAL_WIDTH_OVERRIDE_ID,
  EXTENDED_LINE_HIGHLIGHT_WIDTH_PIXELS,
  EXTENDED_LINE_WIDTH_PIXELS,
  FACE_DEPTH_BIAS,
  FACE_DEPTH_BIAS_SLOPE_SCALE,
  FACE_POSITION_FLOATS,
  FAR_PLANE,
  HIDDEN_BRIGHTNESS,
  HIDDEN_DASH_LENGTH_PIXELS,
  HIDDEN_EXTENDED_LINE_HIGHLIGHT_WIDTH_PIXELS,
  HIDDEN_EXTENDED_LINE_WIDTH_PIXELS,
  HIDDEN_GAP_LENGTH_PIXELS,
  HIDDEN_SEGMENT_HIGHLIGHT_WIDTH_PIXELS,
  HIDDEN_SEGMENT_WIDTH_PIXELS,
  HIGHLIGHT_COLOR,
  LINE_EXTENSION_LENGTH,
  MARKER_SIZE_OVERRIDE_ID,
  MARKER_USE_HIGHLIGHT_COLOR_OVERRIDE_ID,
  MSAA_SAMPLE_COUNT,
  NEAR_PLANE,
  ORTHO_SCALE,
  SEGMENT_HIGHLIGHT_WIDTH_PIXELS,
  SEGMENT_WIDTH_PIXELS,
  VERTEX_MARKER_SIZE_PIXELS,
  VERTEX_MARKER_SMALL_SIZE_PIXELS,
  VERTICES_PER_LINE_QUAD,
} from '../stereometry-constants';
import type { DragPreviewState } from '../stereometry-drag-connector';
import { createWireframeFromTopology } from '../stereometry-geometry';
import type { FigureTopology, SceneState, SelectionState } from '../stereometry-types';

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

/** Each extended edge is split into 2 line instances (before-segment and after-segment halves) */
const HALVES_PER_EXTENDED_EDGE = 2;

/** Vertex marker instance slot 0: position vec3 = 3 floats */
const MARKER_INSTANCE_FLOATS = 3;
const MARKER_INSTANCE_STRIDE = MARKER_INSTANCE_FLOATS * FLOAT32_BYTES;

/** Vertex marker instance slot 1: brightness f32 = 1 float */
const MARKER_BRIGHTNESS_STRIDE = FLOAT32_BYTES;

/** Ray epsilon for occlusion test — avoid self-intersection at ray origin */
const OCCLUSION_RAY_EPSILON = 1e-6;

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

/** Homogeneous w-component for position vectors */
const HOMOGENEOUS_W = 1.0;

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
  private visibleLinePipeline!: GPURenderPipeline;
  private hiddenLinePipeline!: GPURenderPipeline;
  private selectionMarkerPipeline!: GPURenderPipeline;
  private persistentMarkerPipeline!: GPURenderPipeline;
  private previewEdgePipeline!: GPURenderPipeline;

  private bindGroup!: GPUBindGroup;
  private previewBindGroup!: GPUBindGroup;
  private uniformBuffer!: GPUBuffer;
  private previewUniformBuffer!: GPUBuffer;
  private edgeInstanceBuffer!: GPUBuffer;
  private faceVertexBuffer!: GPUBuffer;
  private highlightFlagBuffer!: GPUBuffer;
  private lineInstanceBuffer!: GPUBuffer;
  private lineHighlightBuffer!: GPUBuffer;
  private topologyVertexMarkerBuffer!: GPUBuffer;
  private topologyVertexBrightnessBuffer!: GPUBuffer;
  private userSegmentInstanceBuffer!: GPUBuffer;
  private userSegmentHighlightBuffer!: GPUBuffer;
  private previewLineBuffer!: GPUBuffer;
  private previewLineHighlightBuffer!: GPUBuffer;
  private previewStartMarkerBuffer!: GPUBuffer;
  private previewStartBrightnessBuffer!: GPUBuffer;
  private previewSnapMarkerBuffer!: GPUBuffer;
  private previewSnapBrightnessBuffer!: GPUBuffer;
  private edgeCount = 0;
  private faceVertexCount = 0;
  private depthTexture: GPUTexture | null = null;

  private lastMvpMatrix = new Float32Array(16);
  private extendedLineCount = 0;
  private extendedEdgeIndexList: number[] = [];
  private selectedEdgeIndex: number | null = null;
  private userSegmentCount = 0;
  private topologyVertexCount = 0;
  private allVertexPositions: readonly (readonly [number, number, number])[] = [];
  private hasDragPreview = false;
  private hasSnapTarget = false;
  private lastCanvasWidth = 0;
  private lastCanvasHeight = 0;
  private lastDevicePixelRatio = 1;

  constructor(
    private readonly camera: OrbitalCameraController,
    private readonly msaaManager: MsaaTextureManager,
    private readonly topology: FigureTopology
  ) {}

  init(context: GpuContext): void {
    this.device = context.device;
    this.format = context.format;

    const wireframe = createWireframeFromTopology(this.topology);
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
      size: this.edgeCount * UINT32_BYTES,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Each extended edge is split into 2 halves (before + after the segment)
    this.lineInstanceBuffer = this.device.createBuffer({
      size: this.edgeCount * HALVES_PER_EXTENDED_EDGE * INSTANCE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Max intersections: C(10,2) = 45
    const maxIntersections = (this.edgeCount * (this.edgeCount - 1)) / 2;

    // Vertex markers: topology vertices + potential intersection vertices
    const maxVertexCount = this.topology.vertices.length + maxIntersections;
    this.topologyVertexMarkerBuffer = this.device.createBuffer({
      size: maxVertexCount * MARKER_INSTANCE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.topologyVertexBrightnessBuffer = this.device.createBuffer({
      size: maxVertexCount * MARKER_BRIGHTNESS_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // User-created segments (pre-allocate for reasonable count)
    const maxUserSegments = maxIntersections;
    this.userSegmentInstanceBuffer = this.device.createBuffer({
      size: Math.max(INSTANCE_STRIDE, maxUserSegments * INSTANCE_STRIDE),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.userSegmentHighlightBuffer = this.device.createBuffer({
      size: Math.max(UINT32_BYTES, maxUserSegments * UINT32_BYTES),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // All extended lines are always highlighted
    this.lineHighlightBuffer = this.device.createBuffer({
      size: this.edgeCount * HALVES_PER_EXTENDED_EDGE * UINT32_BYTES,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Drag-to-connect preview buffers
    this.previewLineBuffer = this.device.createBuffer({
      size: INSTANCE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.previewLineHighlightBuffer = this.device.createBuffer({
      size: UINT32_BYTES,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    // Preview line is always highlighted (uses highlight color from uniform)
    this.device.queue.writeBuffer(this.previewLineHighlightBuffer, 0, new Uint32Array([1]));
    this.previewStartMarkerBuffer = this.device.createBuffer({
      size: MARKER_INSTANCE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.previewStartBrightnessBuffer = this.device.createBuffer({
      size: MARKER_BRIGHTNESS_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.previewStartBrightnessBuffer, 0, new Float32Array([1.0]));
    this.previewSnapMarkerBuffer = this.device.createBuffer({
      size: MARKER_INSTANCE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.previewSnapBrightnessBuffer = this.device.createBuffer({
      size: MARKER_BRIGHTNESS_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.previewSnapBrightnessBuffer, 0, new Float32Array([1.0]));

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

    // Preview uniform buffer with orange highlight color
    this.previewUniformBuffer = this.device.createBuffer({
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(
      this.previewUniformBuffer,
      HIGHLIGHT_COLOR_BYTE_OFFSET,
      new Float32Array(DRAG_PREVIEW_COLOR)
    );
    this.device.queue.writeBuffer(
      this.previewUniformBuffer,
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

    this.previewBindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.previewUniformBuffer } }],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    this.depthFacesPipeline = this.createDepthFacesPipeline(pipelineLayout);

    this.visibleEdgePipeline = this.createEdgePipeline(pipelineLayout, {
      depthCompare: 'less-equal',
      depthWriteEnabled: true,
      normalWidth: SEGMENT_WIDTH_PIXELS,
      highlightWidth: SEGMENT_HIGHLIGHT_WIDTH_PIXELS,
    });

    this.hiddenEdgePipeline = this.createEdgePipeline(pipelineLayout, {
      depthCompare: 'greater',
      depthWriteEnabled: false,
      normalWidth: HIDDEN_SEGMENT_WIDTH_PIXELS,
      highlightWidth: HIDDEN_SEGMENT_HIGHLIGHT_WIDTH_PIXELS,
      brightness: HIDDEN_BRIGHTNESS,
      dashLength: HIDDEN_DASH_LENGTH_PIXELS,
      gapLength: HIDDEN_GAP_LENGTH_PIXELS,
    });

    this.visibleLinePipeline = this.createEdgePipeline(pipelineLayout, {
      depthCompare: 'less-equal',
      depthWriteEnabled: true,
      normalWidth: EXTENDED_LINE_WIDTH_PIXELS,
      highlightWidth: EXTENDED_LINE_HIGHLIGHT_WIDTH_PIXELS,
    });

    this.hiddenLinePipeline = this.createEdgePipeline(pipelineLayout, {
      depthCompare: 'greater',
      depthWriteEnabled: false,
      normalWidth: HIDDEN_EXTENDED_LINE_WIDTH_PIXELS,
      highlightWidth: HIDDEN_EXTENDED_LINE_HIGHLIGHT_WIDTH_PIXELS,
      brightness: HIDDEN_BRIGHTNESS,
      dashLength: HIDDEN_DASH_LENGTH_PIXELS,
      gapLength: HIDDEN_GAP_LENGTH_PIXELS,
    });

    this.selectionMarkerPipeline = this.createVertexMarkerPipeline(pipelineLayout, {
      depthCompare: 'always',
    });

    this.persistentMarkerPipeline = this.createVertexMarkerPipeline(pipelineLayout, {
      depthCompare: 'always',
      highlighted: false,
      markerSize: VERTEX_MARKER_SMALL_SIZE_PIXELS,
    });

    // Preview edge pipeline: always visible, 3px width, uses preview bind group (orange)
    this.previewEdgePipeline = this.createEdgePipeline(pipelineLayout, {
      depthCompare: 'always',
      depthWriteEnabled: false,
      normalWidth: SEGMENT_WIDTH_PIXELS,
      highlightWidth: SEGMENT_WIDTH_PIXELS,
    });
  }

  update(state: FrameState): void {
    this.camera.tick();

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

    this.device.queue.writeBuffer(this.uniformBuffer, MVP_BYTE_OFFSET, mvpMatrix);
    const viewportData = new Float32Array([state.canvasWidth, state.canvasHeight]);
    this.device.queue.writeBuffer(this.uniformBuffer, VIEWPORT_BYTE_OFFSET, viewportData);

    // Keep preview uniform buffer in sync with MVP and viewport
    this.device.queue.writeBuffer(this.previewUniformBuffer, MVP_BYTE_OFFSET, mvpMatrix);
    this.device.queue.writeBuffer(this.previewUniformBuffer, VIEWPORT_BYTE_OFFSET, viewportData);

    this.updateMarkerBrightness();
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

    // Pass 2a: Hidden user lines (same thin style as extended lines)
    if (this.userSegmentCount > 0) {
      pass.setPipeline(this.hiddenLinePipeline);
      pass.setVertexBuffer(0, this.userSegmentInstanceBuffer);
      pass.setVertexBuffer(1, this.userSegmentHighlightBuffer);
      pass.draw(VERTICES_PER_LINE_QUAD, this.userSegmentCount);
    }

    // Pass 2b: Hidden extended lines (thinner, persistent)
    if (this.extendedLineCount > 0) {
      pass.setPipeline(this.hiddenLinePipeline);
      pass.setVertexBuffer(0, this.lineInstanceBuffer);
      pass.setVertexBuffer(1, this.lineHighlightBuffer);
      pass.draw(VERTICES_PER_LINE_QUAD, this.extendedLineCount);
    }

    // Pass 3: Visible edges (in front of faces, opaque)
    pass.setPipeline(this.visibleEdgePipeline);
    pass.setVertexBuffer(0, this.edgeInstanceBuffer);
    pass.setVertexBuffer(1, this.highlightFlagBuffer);
    pass.draw(VERTICES_PER_LINE_QUAD, this.edgeCount);

    // Pass 3a: Visible user lines (same thin style as extended lines)
    if (this.userSegmentCount > 0) {
      pass.setPipeline(this.visibleLinePipeline);
      pass.setVertexBuffer(0, this.userSegmentInstanceBuffer);
      pass.setVertexBuffer(1, this.userSegmentHighlightBuffer);
      pass.draw(VERTICES_PER_LINE_QUAD, this.userSegmentCount);
    }

    // Pass 3b: Visible extended lines (thinner, persistent)
    if (this.extendedLineCount > 0) {
      pass.setPipeline(this.visibleLinePipeline);
      pass.setVertexBuffer(0, this.lineInstanceBuffer);
      pass.setVertexBuffer(1, this.lineHighlightBuffer);
      pass.draw(VERTICES_PER_LINE_QUAD, this.extendedLineCount);
    }

    // Pass 4: Topology vertex markers (white, per-instance brightness)
    if (this.topologyVertexCount > 0) {
      pass.setPipeline(this.persistentMarkerPipeline);
      pass.setVertexBuffer(0, this.topologyVertexMarkerBuffer);
      pass.setVertexBuffer(1, this.topologyVertexBrightnessBuffer);
      pass.draw(VERTICES_PER_MARKER_QUAD, this.topologyVertexCount);
    }

    // Pass 5: Drag-to-connect preview line (orange, always visible)
    if (this.hasDragPreview) {
      pass.setPipeline(this.previewEdgePipeline);
      pass.setBindGroup(0, this.previewBindGroup);
      pass.setVertexBuffer(0, this.previewLineBuffer);
      pass.setVertexBuffer(1, this.previewLineHighlightBuffer);
      pass.draw(VERTICES_PER_LINE_QUAD, 1);

      // Pass 7: Start vertex marker (orange, always visible)
      pass.setPipeline(this.selectionMarkerPipeline);
      pass.setVertexBuffer(0, this.previewStartMarkerBuffer);
      pass.setVertexBuffer(1, this.previewStartBrightnessBuffer);
      pass.draw(VERTICES_PER_MARKER_QUAD, 1);

      pass.setBindGroup(0, this.bindGroup);
    }

    // Pass 8: Snap target marker (orange, always visible)
    if (this.hasSnapTarget) {
      pass.setPipeline(this.selectionMarkerPipeline);
      pass.setBindGroup(0, this.previewBindGroup);
      pass.setVertexBuffer(0, this.previewSnapMarkerBuffer);
      pass.setVertexBuffer(1, this.previewSnapBrightnessBuffer);
      pass.draw(VERTICES_PER_MARKER_QUAD, 1);
      pass.setBindGroup(0, this.bindGroup);
    }

    pass.end();
  }

  getLastMvpMatrix(): Float32Array {
    return this.lastMvpMatrix;
  }

  setSelection(selection: SelectionState): void {
    const highlightFlags = new Uint32Array(this.edgeCount);

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
      default:
        assertNever(selection);
    }

    this.device.queue.writeBuffer(this.highlightFlagBuffer, 0, highlightFlags);
    this.updateLineHighlights();
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

    this.device.queue.writeBuffer(
      this.previewLineBuffer,
      0,
      new Float32Array([
        preview.startPosition[0],
        preview.startPosition[1],
        preview.startPosition[2],
        endPosition[0],
        endPosition[1],
        endPosition[2],
      ])
    );

    this.hasDragPreview = true;

    this.device.queue.writeBuffer(
      this.previewStartMarkerBuffer,
      0,
      new Float32Array(preview.startPosition)
    );

    if (!isNil(preview.snapTargetPosition)) {
      this.device.queue.writeBuffer(
        this.previewSnapMarkerBuffer,
        0,
        new Float32Array(preview.snapTargetPosition)
      );
      this.hasSnapTarget = true;
    } else {
      this.hasSnapTarget = false;
    }
  }

  /**
   * Applies the full scene state to GPU buffers.
   * Updates extended line instances, their highlight flags, and intersection markers.
   */
  applySceneState(scene: SceneState): void {
    this.applyTopologyVertices(scene);
    this.applyExtendedSegments(scene);
    this.applyUserSegments(scene);
  }

  private applyTopologyVertices(scene: SceneState): void {
    this.topologyVertexCount = scene.vertices.length;
    this.allVertexPositions = scene.vertices.map(vertex => vertex.position);

    if (this.topologyVertexCount === 0) {
      return;
    }

    const markerData = new Float32Array(this.topologyVertexCount * MARKER_INSTANCE_FLOATS);
    for (let index = 0; index < this.topologyVertexCount; index++) {
      const position = scene.vertices[index].position;
      const offset = index * MARKER_INSTANCE_FLOATS;
      markerData[offset] = position[0];
      markerData[offset + 1] = position[1];
      markerData[offset + 2] = position[2];
    }

    this.device.queue.writeBuffer(this.topologyVertexMarkerBuffer, 0, markerData);
  }

  private applyExtendedSegments(scene: SceneState): void {
    this.extendedEdgeIndexList = scene.lines.map(line => line.edgeIndex);
    // Each extended edge produces 2 line instances (halves that don't overlap the segment)
    this.extendedLineCount = this.extendedEdgeIndexList.length * HALVES_PER_EXTENDED_EDGE;

    if (this.extendedLineCount === 0) {
      return;
    }

    const lineData = new Float32Array(this.extendedLineCount * FLOATS_PER_EDGE_INSTANCE);
    let lineOffset = 0;

    for (const edgeIndex of this.extendedEdgeIndexList) {
      const [beforeHalf, afterHalf] = this.computeExtendedLineHalves(edgeIndex);
      lineData.set(beforeHalf, lineOffset);
      lineOffset += FLOATS_PER_EDGE_INSTANCE;
      lineData.set(afterHalf, lineOffset);
      lineOffset += FLOATS_PER_EDGE_INSTANCE;
    }

    this.device.queue.writeBuffer(this.lineInstanceBuffer, 0, lineData);
    this.updateLineHighlights();
  }

  private applyUserSegments(scene: SceneState): void {
    this.userSegmentCount = scene.userSegments.length;

    if (this.userSegmentCount === 0) {
      return;
    }

    const instanceData = new Float32Array(this.userSegmentCount * FLOATS_PER_EDGE_INSTANCE);
    const highlightFlags = new Uint32Array(this.userSegmentCount);

    for (let index = 0; index < this.userSegmentCount; index++) {
      const segment = scene.userSegments[index];
      const extendedLine = this.computeExtendedLineFromPositions(
        segment.startPosition,
        segment.endPosition
      );
      instanceData.set(extendedLine, index * FLOATS_PER_EDGE_INSTANCE);
      highlightFlags[index] = 0;
    }

    this.device.queue.writeBuffer(this.userSegmentInstanceBuffer, 0, instanceData);
    this.device.queue.writeBuffer(this.userSegmentHighlightBuffer, 0, highlightFlags);
  }

  /**
   * Computes per-instance brightness for all markers based on occlusion.
   * For orthographic projection, casts a parallel ray through each vertex
   * along the view direction to check if any face is in front of it.
   */
  private updateMarkerBrightness(): void {
    if (this.topologyVertexCount === 0) {
      return;
    }

    const viewDirection = this.computeViewDirection();
    const brightness = new Float32Array(this.topologyVertexCount);

    for (let index = 0; index < this.topologyVertexCount; index++) {
      const position = this.allVertexPositions[index];
      brightness[index] = this.isVertexOccluded(viewDirection, position) ? HIDDEN_BRIGHTNESS : 1.0;
    }

    this.device.queue.writeBuffer(this.topologyVertexBrightnessBuffer, 0, brightness);
  }

  /**
   * Computes the normalized view direction (from camera towards target).
   */
  private computeViewDirection(): readonly [number, number, number] {
    const viewMatrix = this.camera.getViewMatrix();
    // View direction is the negative Z axis of the view matrix (row 2, negated)
    // In column-major: elements [2], [6], [10] form the -forward direction
    return [-viewMatrix[2], -viewMatrix[6], -viewMatrix[10]];
  }

  /**
   * Tests if a vertex is occluded by any face triangle.
   * For orthographic projection, casts a PARALLEL ray through the vertex
   * along the view direction (not from the eye point). This ensures correct
   * occlusion regardless of camera pan offset.
   */
  private isVertexOccluded(
    viewDirection: readonly [number, number, number],
    vertexPosition: readonly [number, number, number]
  ): boolean {
    // Start the ray far behind the vertex (opposite to view direction)
    const rayOrigin: readonly [number, number, number] = [
      vertexPosition[0] - viewDirection[0] * FAR_PLANE,
      vertexPosition[1] - viewDirection[1] * FAR_PLANE,
      vertexPosition[2] - viewDirection[2] * FAR_PLANE,
    ];

    for (const triangleIndices of this.topology.faceTriangles) {
      const vertexA = this.topology.vertices[triangleIndices[0]];
      const vertexB = this.topology.vertices[triangleIndices[1]];
      const vertexC = this.topology.vertices[triangleIndices[2]];

      const parameterT = this.rayTriangleIntersect(
        rayOrigin,
        viewDirection,
        vertexA,
        vertexB,
        vertexC
      );

      // Face is in front of the vertex if t < FAR_PLANE (the vertex is at t = FAR_PLANE)
      if (
        parameterT !== undefined &&
        parameterT > OCCLUSION_RAY_EPSILON &&
        parameterT < FAR_PLANE - OCCLUSION_RAY_EPSILON
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Möller–Trumbore ray-triangle intersection.
   * Returns parametric t along the ray, or undefined if no intersection.
   */
  private rayTriangleIntersect(
    rayOrigin: readonly [number, number, number],
    rayDirection: readonly [number, number, number],
    vertexA: readonly [number, number, number],
    vertexB: readonly [number, number, number],
    vertexC: readonly [number, number, number]
  ): number | undefined {
    const edgeAB = [vertexB[0] - vertexA[0], vertexB[1] - vertexA[1], vertexB[2] - vertexA[2]];
    const edgeAC = [vertexC[0] - vertexA[0], vertexC[1] - vertexA[1], vertexC[2] - vertexA[2]];

    const pVecX = rayDirection[1] * edgeAC[2] - rayDirection[2] * edgeAC[1];
    const pVecY = rayDirection[2] * edgeAC[0] - rayDirection[0] * edgeAC[2];
    const pVecZ = rayDirection[0] * edgeAC[1] - rayDirection[1] * edgeAC[0];

    const determinant = edgeAB[0] * pVecX + edgeAB[1] * pVecY + edgeAB[2] * pVecZ;

    if (Math.abs(determinant) < OCCLUSION_RAY_EPSILON) {
      return undefined;
    }

    const inverseDeterminant = 1.0 / determinant;

    const tVecX = rayOrigin[0] - vertexA[0];
    const tVecY = rayOrigin[1] - vertexA[1];
    const tVecZ = rayOrigin[2] - vertexA[2];

    const barycentricU = (tVecX * pVecX + tVecY * pVecY + tVecZ * pVecZ) * inverseDeterminant;
    if (barycentricU < 0 || barycentricU > 1) {
      return undefined;
    }

    const qVecX = tVecY * edgeAB[2] - tVecZ * edgeAB[1];
    const qVecY = tVecZ * edgeAB[0] - tVecX * edgeAB[2];
    const qVecZ = tVecX * edgeAB[1] - tVecY * edgeAB[0];

    const barycentricV =
      (rayDirection[0] * qVecX + rayDirection[1] * qVecY + rayDirection[2] * qVecZ) *
      inverseDeterminant;
    if (barycentricV < 0 || barycentricU + barycentricV > 1) {
      return undefined;
    }

    return (edgeAC[0] * qVecX + edgeAC[1] * qVecY + edgeAC[2] * qVecZ) * inverseDeterminant;
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.previewUniformBuffer.destroy();
    this.edgeInstanceBuffer.destroy();
    this.faceVertexBuffer.destroy();
    this.highlightFlagBuffer.destroy();
    this.lineInstanceBuffer.destroy();
    this.lineHighlightBuffer.destroy();
    this.topologyVertexMarkerBuffer.destroy();
    this.topologyVertexBrightnessBuffer.destroy();
    this.userSegmentInstanceBuffer.destroy();
    this.userSegmentHighlightBuffer.destroy();
    this.previewLineBuffer.destroy();
    this.previewLineHighlightBuffer.destroy();
    this.previewStartMarkerBuffer.destroy();
    this.previewStartBrightnessBuffer.destroy();
    this.previewSnapMarkerBuffer.destroy();
    this.previewSnapBrightnessBuffer.destroy();
    this.depthTexture?.destroy();
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

  /**
   * Updates highlight flags for extended lines based on current selection.
   * Only the line matching the selected edge is highlighted; others use normal style.
   */
  private updateLineHighlights(): void {
    if (this.extendedLineCount === 0) {
      return;
    }

    const flags = new Uint32Array(this.extendedLineCount);
    for (
      let edgeListIndex = 0;
      edgeListIndex < this.extendedEdgeIndexList.length;
      edgeListIndex++
    ) {
      const highlighted =
        this.extendedEdgeIndexList[edgeListIndex] === this.selectedEdgeIndex ? 1 : 0;
      const instanceBase = edgeListIndex * HALVES_PER_EXTENDED_EDGE;
      flags[instanceBase] = highlighted;
      flags[instanceBase + 1] = highlighted;
    }

    this.device.queue.writeBuffer(this.lineHighlightBuffer, 0, flags);
  }

  /**
   * Computes two line halves for an extended edge that don't overlap the segment.
   * Returns [beforeHalf, afterHalf]:
   *   beforeHalf: far-start → positionA (extension before the segment)
   *   afterHalf:  positionB → far-end   (extension after the segment)
   */
  private computeExtendedLineHalves(edgeIndex: number): [Float32Array, Float32Array] {
    const [vertexIndexA, vertexIndexB] = this.topology.edges[edgeIndex];
    const positionA = this.topology.vertices[vertexIndexA];
    const positionB = this.topology.vertices[vertexIndexB];

    const directionX = positionB[0] - positionA[0];
    const directionY = positionB[1] - positionA[1];
    const directionZ = positionB[2] - positionA[2];
    const segmentLength = Math.sqrt(
      directionX * directionX + directionY * directionY + directionZ * directionZ
    );

    if (segmentLength === 0) {
      const point = new Float32Array([...positionA, ...positionA]);
      return [point, new Float32Array(point)];
    }

    const normalizedX = directionX / segmentLength;
    const normalizedY = directionY / segmentLength;
    const normalizedZ = directionZ / segmentLength;

    const beforeHalf = new Float32Array([
      positionA[0] - normalizedX * LINE_EXTENSION_LENGTH,
      positionA[1] - normalizedY * LINE_EXTENSION_LENGTH,
      positionA[2] - normalizedZ * LINE_EXTENSION_LENGTH,
      positionA[0],
      positionA[1],
      positionA[2],
    ]);

    const afterHalf = new Float32Array([
      positionB[0],
      positionB[1],
      positionB[2],
      positionB[0] + normalizedX * LINE_EXTENSION_LENGTH,
      positionB[1] + normalizedY * LINE_EXTENSION_LENGTH,
      positionB[2] + normalizedZ * LINE_EXTENSION_LENGTH,
    ]);

    return [beforeHalf, afterHalf];
  }

  private computeExtendedLineFromPositions(
    positionA: readonly [number, number, number],
    positionB: readonly [number, number, number]
  ): Float32Array {
    const directionX = positionB[0] - positionA[0];
    const directionY = positionB[1] - positionA[1];
    const directionZ = positionB[2] - positionA[2];
    const segmentLength = Math.sqrt(
      directionX * directionX + directionY * directionY + directionZ * directionZ
    );

    // Guard against degenerate zero-length segments to prevent NaN propagation
    if (segmentLength === 0) {
      return new Float32Array([
        positionA[0],
        positionA[1],
        positionA[2],
        positionB[0],
        positionB[1],
        positionB[2],
      ]);
    }

    const normalizedX = directionX / segmentLength;
    const normalizedY = directionY / segmentLength;
    const normalizedZ = directionZ / segmentLength;

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
      dashLength?: number;
      gapLength?: number;
    }
  ): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({ code: edgeShaderSource });

    const fragmentConstants: Record<number, number> = {
      [EDGE_BRIGHTNESS_OVERRIDE_ID]: options.brightness ?? 1.0,
    };

    if (options.dashLength !== undefined) {
      fragmentConstants[EDGE_DASH_LENGTH_OVERRIDE_ID] = options.dashLength;
    }
    if (options.gapLength !== undefined) {
      fragmentConstants[EDGE_GAP_LENGTH_OVERRIDE_ID] = options.gapLength;
    }

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
        constants: fragmentConstants,
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
      highlighted?: boolean;
      markerSize?: number;
    }
  ): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({ code: vertexMarkerShaderSource });
    const vertexConstants: Record<string, number> = {};
    if (options.markerSize !== undefined) {
      vertexConstants[MARKER_SIZE_OVERRIDE_ID] = options.markerSize;
    }

    return this.device.createRenderPipeline({
      layout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        constants: Object.keys(vertexConstants).length > 0 ? vertexConstants : undefined,
        buffers: [
          {
            arrayStride: MARKER_INSTANCE_STRIDE,
            stepMode: 'instance',
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
          },
          {
            arrayStride: MARKER_BRIGHTNESS_STRIDE,
            stepMode: 'instance',
            attributes: [{ shaderLocation: 1, offset: 0, format: 'float32' }],
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
          [MARKER_USE_HIGHLIGHT_COLOR_OVERRIDE_ID]: (options.highlighted ?? true) ? 1.0 : 0.0,
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
