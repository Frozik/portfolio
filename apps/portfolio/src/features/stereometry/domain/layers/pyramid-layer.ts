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
  EDGE_HIGHLIGHT_WIDTH_OVERRIDE_ID,
  EDGE_NORMAL_WIDTH_OVERRIDE_ID,
  EXTENDED_LINE_HIGHLIGHT_WIDTH_PIXELS,
  EXTENDED_LINE_WIDTH_PIXELS,
  FACE_DEPTH_BIAS,
  FACE_DEPTH_BIAS_SLOPE_SCALE,
  FACE_POSITION_FLOATS,
  FAR_PLANE,
  HIDDEN_BRIGHTNESS,
  HIDDEN_EXTENDED_LINE_HIGHLIGHT_WIDTH_PIXELS,
  HIDDEN_EXTENDED_LINE_WIDTH_PIXELS,
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
  private visibleLinePipeline!: GPURenderPipeline;
  private hiddenLinePipeline!: GPURenderPipeline;
  private selectionMarkerPipeline!: GPURenderPipeline;
  private persistentMarkerPipeline!: GPURenderPipeline;

  private bindGroup!: GPUBindGroup;
  private uniformBuffer!: GPUBuffer;
  private edgeInstanceBuffer!: GPUBuffer;
  private faceVertexBuffer!: GPUBuffer;
  private highlightFlagBuffer!: GPUBuffer;
  private vertexMarkerBuffer!: GPUBuffer;
  private lineInstanceBuffer!: GPUBuffer;
  private lineHighlightBuffer!: GPUBuffer;
  private intersectionMarkerBuffer!: GPUBuffer;
  private topologyVertexMarkerBuffer!: GPUBuffer;
  private topologyVertexBrightnessBuffer!: GPUBuffer;
  private intersectionBrightnessBuffer!: GPUBuffer;
  private selectionBrightnessBuffer!: GPUBuffer;
  private edgeCount = 0;
  private faceVertexCount = 0;
  private depthTexture: GPUTexture | null = null;

  private lastMvpMatrix = new Float32Array(16);
  private hasVertexMarker = false;
  private extendedLineCount = 0;
  private extendedEdgeIndexList: number[] = [];
  private selectedEdgeIndex: number | null = null;
  private intersectionMarkerCount = 0;
  private topologyVertexCount = 0;
  private intersectionPositions: readonly (readonly [number, number, number])[] = [];

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

    this.vertexMarkerBuffer = this.device.createBuffer({
      size: MARKER_INSTANCE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.lineInstanceBuffer = this.device.createBuffer({
      size: this.edgeCount * INSTANCE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Max intersections: C(10,2) = 45
    const maxIntersections = (this.edgeCount * (this.edgeCount - 1)) / 2;
    this.intersectionMarkerBuffer = this.device.createBuffer({
      size: Math.max(MARKER_INSTANCE_STRIDE, maxIntersections * MARKER_INSTANCE_STRIDE),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Topology vertex markers (6 vertices of the pyramid)
    this.topologyVertexMarkerBuffer = this.device.createBuffer({
      size: this.topology.vertices.length * MARKER_INSTANCE_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.topologyVertexBrightnessBuffer = this.device.createBuffer({
      size: this.topology.vertices.length * MARKER_BRIGHTNESS_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.intersectionBrightnessBuffer = this.device.createBuffer({
      size: Math.max(MARKER_BRIGHTNESS_STRIDE, maxIntersections * MARKER_BRIGHTNESS_STRIDE),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Selection marker always full brightness
    this.selectionBrightnessBuffer = this.device.createBuffer({
      size: MARKER_BRIGHTNESS_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.selectionBrightnessBuffer, 0, new Float32Array([1.0]));

    // All extended lines are always highlighted
    this.lineHighlightBuffer = this.device.createBuffer({
      size: this.edgeCount * UINT32_BYTES,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    const allHighlighted = new Uint32Array(this.edgeCount).fill(1);
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
      normalWidth: SEGMENT_WIDTH_PIXELS,
      highlightWidth: SEGMENT_HIGHLIGHT_WIDTH_PIXELS,
    });

    this.hiddenEdgePipeline = this.createEdgePipeline(pipelineLayout, {
      depthCompare: 'greater',
      depthWriteEnabled: false,
      normalWidth: HIDDEN_SEGMENT_WIDTH_PIXELS,
      highlightWidth: HIDDEN_SEGMENT_HIGHLIGHT_WIDTH_PIXELS,
      brightness: HIDDEN_BRIGHTNESS,
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
    });

    this.selectionMarkerPipeline = this.createVertexMarkerPipeline(pipelineLayout, {
      depthCompare: 'always',
    });

    this.persistentMarkerPipeline = this.createVertexMarkerPipeline(pipelineLayout, {
      depthCompare: 'always',
      highlighted: false,
      markerSize: VERTEX_MARKER_SMALL_SIZE_PIXELS,
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

    this.device.queue.writeBuffer(this.uniformBuffer, MVP_BYTE_OFFSET, mvpMatrix);
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      VIEWPORT_BYTE_OFFSET,
      new Float32Array([state.canvasWidth, state.canvasHeight])
    );

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

    // Pass 5: Intersection markers (white, per-instance brightness)
    if (this.intersectionMarkerCount > 0) {
      pass.setPipeline(this.persistentMarkerPipeline);
      pass.setVertexBuffer(0, this.intersectionMarkerBuffer);
      pass.setVertexBuffer(1, this.intersectionBrightnessBuffer);
      pass.draw(VERTICES_PER_MARKER_QUAD, this.intersectionMarkerCount);
    }

    // Pass 6: Selection vertex marker (highlight color, always full brightness)
    if (this.hasVertexMarker) {
      pass.setPipeline(this.selectionMarkerPipeline);
      pass.setVertexBuffer(0, this.vertexMarkerBuffer);
      pass.setVertexBuffer(1, this.selectionBrightnessBuffer);
      pass.draw(VERTICES_PER_MARKER_QUAD, SINGLE_MARKER_INSTANCE);
    }

    pass.end();
  }

  getLastMvpMatrix(): Float32Array {
    return this.lastMvpMatrix;
  }

  setSelection(selection: SelectionState): void {
    const highlightFlags = new Uint32Array(this.edgeCount);

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
      case 'intersection': {
        this.hasVertexMarker = true;
        this.device.queue.writeBuffer(
          this.vertexMarkerBuffer,
          0,
          new Float32Array(this.intersectionPositions[selection.intersectionIndex])
        );
        break;
      }
    }

    this.device.queue.writeBuffer(this.highlightFlagBuffer, 0, highlightFlags);
    this.updateLineHighlights();
  }

  /**
   * Applies the full scene state to GPU buffers.
   * Updates extended line instances, their highlight flags, and intersection markers.
   */
  applySceneState(scene: SceneState): void {
    this.applyTopologyVertices(scene);
    this.applyExtendedSegments(scene);
    this.applyIntersectionMarkers(scene);
  }

  private applyTopologyVertices(scene: SceneState): void {
    this.topologyVertexCount = scene.vertices.length;

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

  private applyIntersectionMarkers(scene: SceneState): void {
    const positions = scene.intersections.map(intersection => intersection.position);
    this.intersectionPositions = positions;
    this.intersectionMarkerCount = positions.length;

    if (positions.length === 0) {
      return;
    }

    const markerData = new Float32Array(positions.length * MARKER_INSTANCE_FLOATS);
    for (let index = 0; index < positions.length; index++) {
      const position = positions[index];
      const offset = index * MARKER_INSTANCE_FLOATS;
      markerData[offset] = position[0];
      markerData[offset + 1] = position[1];
      markerData[offset + 2] = position[2];
    }

    this.device.queue.writeBuffer(this.intersectionMarkerBuffer, 0, markerData);
  }

  /**
   * Computes per-instance brightness for all markers based on occlusion.
   * For orthographic projection, casts a parallel ray through each vertex
   * along the view direction to check if any face is in front of it.
   */
  private updateMarkerBrightness(): void {
    const viewDirection = this.computeViewDirection();

    if (this.topologyVertexCount > 0) {
      const topologyBrightness = new Float32Array(this.topologyVertexCount);
      for (let index = 0; index < this.topologyVertexCount; index++) {
        const position = this.topology.vertices[index];
        topologyBrightness[index] = this.isVertexOccluded(viewDirection, position)
          ? HIDDEN_BRIGHTNESS
          : 1.0;
      }
      this.device.queue.writeBuffer(this.topologyVertexBrightnessBuffer, 0, topologyBrightness);
    }

    if (this.intersectionMarkerCount > 0) {
      const intersectionBrightness = new Float32Array(this.intersectionMarkerCount);
      for (let index = 0; index < this.intersectionMarkerCount; index++) {
        const position = this.intersectionPositions[index];
        intersectionBrightness[index] = this.isVertexOccluded(viewDirection, position)
          ? HIDDEN_BRIGHTNESS
          : 1.0;
      }
      this.device.queue.writeBuffer(this.intersectionBrightnessBuffer, 0, intersectionBrightness);
    }
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
    this.edgeInstanceBuffer.destroy();
    this.faceVertexBuffer.destroy();
    this.highlightFlagBuffer.destroy();
    this.vertexMarkerBuffer.destroy();
    this.lineInstanceBuffer.destroy();
    this.lineHighlightBuffer.destroy();
    this.intersectionMarkerBuffer.destroy();
    this.topologyVertexMarkerBuffer.destroy();
    this.topologyVertexBrightnessBuffer.destroy();
    this.intersectionBrightnessBuffer.destroy();
    this.selectionBrightnessBuffer.destroy();
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
