import type {
  FpsController,
  FrameState,
  GpuContext,
  MsaaTextureManager,
  RenderLayer,
} from '@frozik/utils';
import { isNil } from 'lodash-es';
import { mat4, vec4 } from 'wgpu-matrix';
import type { OrbitalCameraController } from '../camera-controller';
import {
  DEPTH_FADE_MIN,
  DEPTH_FADE_RATE,
  FACE_POSITION_FLOATS,
  FAR_PLANE,
  FIELD_OF_VIEW_RADIANS,
  FPS_ANIMATION,
  HOMOGENEOUS_W,
  MSAA_SAMPLE_COUNT,
  NEAR_PLANE,
  ORTHO_SCALE,
  STEREOMETRY_STYLES,
  VERTICES_PER_LINE_QUAD,
} from '../constants';
import type { DragPreviewState } from '../drag-connector';
import { createWireframeFromTopology } from '../geometry';
import type { SceneRepresentation, StyledMarker, StyledSegment } from '../render-types';
import commonShaderSource from '../shaders/common.wgsl?raw';
import depthFacesSpecificSource from '../shaders/depth-faces.wgsl?raw';
import lineSpecificSource from '../shaders/line.wgsl?raw';
import lineIdSpecificSource from '../shaders/line-id.wgsl?raw';
import solutionFaceSpecificSource from '../shaders/solution-face.wgsl?raw';
import vertexMarkerSpecificSource from '../shaders/vertex-marker.wgsl?raw';
import { hexToRgb, resolveStyle } from '../styles-processor';
import type { FigureTopology, Vec3Array } from '../topology-types';
import type { CameraProjection } from '../types';

const depthFacesShaderSource = commonShaderSource + depthFacesSpecificSource;
const lineShaderSource = commonShaderSource + lineSpecificSource;
const lineIdShaderSource = commonShaderSource + lineIdSpecificSource;
const solutionFaceShaderSource = commonShaderSource + solutionFaceSpecificSource;
const vertexMarkerShaderSource = commonShaderSource + vertexMarkerSpecificSource;

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';
const LINE_ENDPOINT_FORMAT: GPUTextureFormat = 'rg32float';
const MIN_DIMENSION = 1;

/**
 * Depth bias for face geometry in the depth pre-pass.
 * Pushes face depth slightly further from camera so that coplanar lines
 * are classified as "in front" rather than z-fighting with the face.
 */
const FACE_DEPTH_BIAS = 2;
const FACE_DEPTH_BIAS_SLOPE_SCALE = 1.0;

/** Pipeline-overridable render mode constants matching shader `override renderMode` */
const RENDER_MODE_ALL = 0;
const RENDER_MODE_HIDDEN_ONLY = 1;
const RENDER_MODE_VISIBLE_ONLY = 2;

const FLOAT32_BYTES = 4;

/** Number of floats per styled line instance (32 = 128 bytes, matching shader LineInstance layout) */
const FLOATS_PER_STYLED_LINE = 32;
const STYLED_LINE_STRIDE = FLOATS_PER_STYLED_LINE * FLOAT32_BYTES;

/** Shared vertex attributes for styled line instances */
const STYLED_LINE_ATTRIBUTES: GPUVertexAttribute[] = [
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
];

/** Line ID pre-pass vertex attributes: all line attributes + endpoint vertex indices */
const LINE_ID_ATTRIBUTES: GPUVertexAttribute[] = [
  ...STYLED_LINE_ATTRIBUTES,
  { shaderLocation: 14, offset: 88, format: 'float32' }, // startVertexIndex
  { shaderLocation: 15, offset: 92, format: 'float32' }, // endVertexIndex
];

/** Vertex marker instance: position(3) + type(1) + visibleStyle(9) + hiddenStyle(9) + vertexIndex(1) + reserved(1) = 24 floats */
const MARKER_INSTANCE_FLOATS = 24;
const MARKER_INSTANCE_STRIDE = MARKER_INSTANCE_FLOATS * FLOAT32_BYTES;

/** Face vertex: position only (vec3) */
const FACE_VERTEX_STRIDE = FACE_POSITION_FLOATS * FLOAT32_BYTES;

/** Solution face vertex: position(3) + rgba(4) = 7 floats */
const SOLUTION_FACE_VERTEX_FLOATS = 7;
const SOLUTION_FACE_VERTEX_STRIDE = SOLUTION_FACE_VERTEX_FLOATS * FLOAT32_BYTES;

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
 * Main rendering (MSAA, two passes for layered visibility):
 *
 * Hidden pass (depth cleared):
 *   1. Hidden lines -- occluded lines with hidden style
 *   2. Hidden markers -- occluded markers on top of hidden lines
 *
 * Visible pass (depth cleared, color preserved):
 *   3. Visible lines -- non-occluded lines with visible style
 *   4. Visible markers -- non-occluded markers on top of visible lines
 *   5. Preview line -- always visible (drag-to-connect)
 *   6. Preview start marker -- always visible
 *   7. Preview snap marker -- always visible
 */
export class SceneLayer implements RenderLayer {
  private device!: GPUDevice;
  private format!: GPUTextureFormat;

  private hiddenLinePipeline!: GPURenderPipeline;
  private visibleLinePipeline!: GPURenderPipeline;
  private previewLinePipeline!: GPURenderPipeline;
  private hiddenMarkerPipeline!: GPURenderPipeline;
  private visibleMarkerPipeline!: GPURenderPipeline;
  private previewMarkerPipeline!: GPURenderPipeline;
  private hiddenLineIdPipeline!: GPURenderPipeline;
  private visibleLineIdPipeline!: GPURenderPipeline;

  private bindGroup!: GPUBindGroup;
  private lineBindGroup!: GPUBindGroup;
  private previewLineBindGroup!: GPUBindGroup;
  private markerBindGroup!: GPUBindGroup;
  private previewMarkerBindGroup!: GPUBindGroup;
  private depthBindGroupLayout!: GPUBindGroupLayout;
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
  private solutionFacePipeline!: GPURenderPipeline;
  private solutionFaceBuffer!: GPUBuffer;
  private solutionFaceVertexCount = 0;
  private depthSampler!: GPUSampler;
  private faceVertexCount = 0;
  private depthTexture: GPUTexture | null = null;
  private samplingDepthTexture: GPUTexture | null = null;
  private lineEndpointTexture: GPUTexture | null = null;
  private lineDepthTexture: GPUTexture | null = null;

  private lastMvpMatrix = new Float32Array(16);
  private styledLineCount = 0;
  private topologyVertexCount = 0;
  private hasDragPreview = false;
  private currentPreviewLine:
    | { readonly pointA: Vec3Array; readonly pointB: Vec3Array }
    | undefined;
  private hasSnapTarget = false;
  private lastCanvasWidth = 0;
  private lastCanvasHeight = 0;
  private lastDevicePixelRatio = 1;
  private readonly backgroundClearColor: GPUColor;
  private readonly vertexPreviewStyle: {
    markerType: number;
    size: number;
    color: Vec3Array;
    alpha: number;
    strokeColor: Vec3Array;
    strokeWidth: number;
  };

  constructor(
    private readonly camera: OrbitalCameraController,
    private readonly msaaManager: MsaaTextureManager,
    private readonly topology: FigureTopology,
    private readonly fpsController: FpsController,
    private readonly sceneCenter: Vec3Array,
    private readonly projection: CameraProjection = 'perspective'
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

    // Solution face buffer — starts empty, resized on first applySceneState that has data
    this.solutionFaceBuffer = this.device.createBuffer({
      size: SOLUTION_FACE_VERTEX_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

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

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    this.depthPrePassPipeline = this.createDepthPrePassPipeline(pipelineLayout);
    this.solutionFacePipeline = this.createSolutionFacePipeline(pipelineLayout);

    // Bind group layout with depth texture (shared by lines and markers)
    this.depthBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'depth' },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          sampler: { type: 'non-filtering' },
        },
      ],
    });

    // Bind group layout with depth + line ID textures (used by markers)
    this.markerBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'depth' },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          sampler: { type: 'non-filtering' },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'unfilterable-float' },
        },
        {
          binding: 4,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'depth' },
        },
      ],
    });

    this.depthSampler = this.device.createSampler({
      minFilter: 'nearest',
      magFilter: 'nearest',
    });

    const depthPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.depthBindGroupLayout],
    });

    this.hiddenLinePipeline = this.createLinePipeline(depthPipelineLayout, RENDER_MODE_HIDDEN_ONLY);
    this.visibleLinePipeline = this.createLinePipeline(
      depthPipelineLayout,
      RENDER_MODE_VISIBLE_ONLY
    );
    this.previewLinePipeline = this.createPreviewLinePipeline(depthPipelineLayout);

    const markerPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.markerBindGroupLayout],
    });

    this.hiddenMarkerPipeline = this.createMarkerPipeline(
      markerPipelineLayout,
      RENDER_MODE_HIDDEN_ONLY
    );
    this.visibleMarkerPipeline = this.createMarkerPipeline(
      markerPipelineLayout,
      RENDER_MODE_VISIBLE_ONLY
    );
    this.previewMarkerPipeline = this.createMarkerPipeline(
      markerPipelineLayout,
      RENDER_MODE_ALL,
      false
    );

    this.hiddenLineIdPipeline = this.createLineIdPipeline(
      depthPipelineLayout,
      RENDER_MODE_HIDDEN_ONLY
    );
    this.visibleLineIdPipeline = this.createLineIdPipeline(
      depthPipelineLayout,
      RENDER_MODE_VISIBLE_ONLY
    );
  }

  update(state: FrameState): void {
    const isAnimating = this.camera.tick();
    if (isAnimating) {
      this.fpsController.raise(FPS_ANIMATION);
    }

    const viewMatrix = this.camera.getViewMatrix();
    const cameraDistance = this.camera.getDistance();
    const aspect = state.canvasWidth / Math.max(MIN_DIMENSION, state.canvasHeight);

    const projectionMatrix =
      this.projection === 'orthographic'
        ? (() => {
            const halfHeight = cameraDistance * ORTHO_SCALE;
            const halfWidth = halfHeight * aspect;
            return mat4.ortho(
              -halfWidth,
              halfWidth,
              -halfHeight,
              halfHeight,
              NEAR_PLANE,
              FAR_PLANE
            );
          })()
        : mat4.perspective(FIELD_OF_VIEW_RADIANS, aspect, NEAR_PLANE, FAR_PLANE);
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
    const cameraTarget = new Float32Array(this.sceneCenter);
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

    // Depth pre-pass: render faces into non-MSAA depth texture for occlusion sampling
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

    const lineIdTextures = this.ensureLineIdTextures(
      state.canvasWidth,
      state.canvasHeight,
      currentSamplingDepthView
    );

    const depthView = currentDepthTexture.createView();
    const sentinelClearValue = { r: -1, g: -1, b: 0, a: 0 };

    // Hidden line ID pre-pass: render hidden line endpoint indices for marker topology check
    if (this.styledLineCount > 0) {
      const hiddenLineIdPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: lineIdTextures.endpointView,
            clearValue: sentinelClearValue,
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
        depthStencilAttachment: {
          view: lineIdTextures.depthView,
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
        },
      });

      hiddenLineIdPass.setPipeline(this.hiddenLineIdPipeline);
      hiddenLineIdPass.setBindGroup(0, this.lineBindGroup);
      hiddenLineIdPass.setVertexBuffer(0, this.styledLineBuffer);
      hiddenLineIdPass.draw(VERTICES_PER_LINE_QUAD, this.styledLineCount);
      hiddenLineIdPass.end();
    }

    // Hidden pass: occluded lines and markers (drawn first, behind visible layer)
    const hiddenPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: currentMsaaView,
          loadOp: 'clear',
          clearValue: this.backgroundClearColor,
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard',
      },
    });

    // Solution face first — blended region behind the wireframe lines
    if (this.solutionFaceVertexCount > 0) {
      hiddenPass.setPipeline(this.solutionFacePipeline);
      hiddenPass.setBindGroup(0, this.bindGroup);
      hiddenPass.setVertexBuffer(0, this.solutionFaceBuffer);
      hiddenPass.draw(this.solutionFaceVertexCount);
    }

    if (this.styledLineCount > 0) {
      hiddenPass.setPipeline(this.hiddenLinePipeline);
      hiddenPass.setBindGroup(0, this.lineBindGroup);
      hiddenPass.setVertexBuffer(0, this.styledLineBuffer);
      hiddenPass.draw(VERTICES_PER_LINE_QUAD, this.styledLineCount);
    }

    if (this.topologyVertexCount > 0) {
      hiddenPass.setPipeline(this.hiddenMarkerPipeline);
      hiddenPass.setBindGroup(0, this.markerBindGroup);
      hiddenPass.setVertexBuffer(0, this.topologyVertexMarkerBuffer);
      hiddenPass.draw(VERTICES_PER_MARKER_QUAD, this.topologyVertexCount);
    }

    hiddenPass.end();

    // Visible line ID pre-pass: render visible line endpoint indices for marker topology check
    if (this.styledLineCount > 0) {
      const visibleLineIdPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: lineIdTextures.endpointView,
            clearValue: sentinelClearValue,
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
        depthStencilAttachment: {
          view: lineIdTextures.depthView,
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
        },
      });

      visibleLineIdPass.setPipeline(this.visibleLineIdPipeline);
      visibleLineIdPass.setBindGroup(0, this.lineBindGroup);
      visibleLineIdPass.setVertexBuffer(0, this.styledLineBuffer);
      visibleLineIdPass.draw(VERTICES_PER_LINE_QUAD, this.styledLineCount);
      visibleLineIdPass.end();
    }

    // Visible pass: non-occluded lines and markers + preview elements (on top of hidden)
    const visiblePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: currentMsaaView,
          resolveTarget: canvasView,
          loadOp: 'load',
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

    if (this.styledLineCount > 0) {
      visiblePass.setPipeline(this.visibleLinePipeline);
      visiblePass.setBindGroup(0, this.lineBindGroup);
      visiblePass.setVertexBuffer(0, this.styledLineBuffer);
      visiblePass.draw(VERTICES_PER_LINE_QUAD, this.styledLineCount);
    }

    if (this.topologyVertexCount > 0) {
      visiblePass.setPipeline(this.visibleMarkerPipeline);
      visiblePass.setBindGroup(0, this.markerBindGroup);
      visiblePass.setVertexBuffer(0, this.topologyVertexMarkerBuffer);
      visiblePass.draw(VERTICES_PER_MARKER_QUAD, this.topologyVertexCount);
    }

    // Preview line (always visible, no occlusion)
    if (this.hasDragPreview) {
      visiblePass.setPipeline(this.previewLinePipeline);
      visiblePass.setBindGroup(0, this.previewLineBindGroup);
      visiblePass.setVertexBuffer(0, this.previewLineBuffer);
      visiblePass.draw(VERTICES_PER_LINE_QUAD, 1);
    }

    // Preview start marker
    if (this.hasDragPreview) {
      visiblePass.setPipeline(this.previewMarkerPipeline);
      visiblePass.setBindGroup(0, this.previewMarkerBindGroup);
      visiblePass.setVertexBuffer(0, this.previewStartMarkerBuffer);
      visiblePass.draw(VERTICES_PER_MARKER_QUAD, 1);
    }

    // Preview snap target marker
    if (this.hasSnapTarget) {
      visiblePass.setPipeline(this.previewMarkerPipeline);
      visiblePass.setBindGroup(0, this.previewMarkerBindGroup);
      visiblePass.setVertexBuffer(0, this.previewSnapMarkerBuffer);
      visiblePass.draw(VERTICES_PER_MARKER_QUAD, 1);
    }

    visiblePass.end();
  }

  getLastMvpMatrix(): Float32Array {
    return this.lastMvpMatrix;
  }

  /**
   * Updates the drag-to-connect preview state.
   * When preview is defined, computes the end 3D position and writes preview buffers.
   * When undefined, clears the preview.
   */
  getPreviewLine(): { readonly pointA: Vec3Array; readonly pointB: Vec3Array } | undefined {
    return this.currentPreviewLine;
  }

  setDragPreview(preview: DragPreviewState | undefined): void {
    if (isNil(preview)) {
      this.hasDragPreview = false;
      this.hasSnapTarget = false;
      this.currentPreviewLine = undefined;
      return;
    }

    const endPosition = !isNil(preview.snapTargetPosition)
      ? preview.snapTargetPosition
      : this.unprojectToVertexPlane(
          preview.cursorScreenX,
          preview.cursorScreenY,
          preview.startPosition
        );

    this.currentPreviewLine = { pointA: preview.startPosition, pointB: endPosition };

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
   * Applies the full processed graphics (segments + markers) to GPU buffers.
   */
  applySceneState(graphics: SceneRepresentation): void {
    this.applyStyledMarkers(graphics.markers);
    this.applyStyledSegments(graphics.segments);
    this.applySolutionFace(graphics.solutionFace);
  }

  private applySolutionFace(solutionFace: SceneRepresentation['solutionFace']): void {
    if (solutionFace === undefined || solutionFace.vertexCount === 0) {
      this.solutionFaceVertexCount = 0;
      return;
    }

    const requiredSize = solutionFace.vertices.byteLength;
    if (requiredSize > this.solutionFaceBuffer.size) {
      this.solutionFaceBuffer.destroy();
      this.solutionFaceBuffer = this.device.createBuffer({
        size: requiredSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
    }

    this.device.queue.writeBuffer(this.solutionFaceBuffer, 0, solutionFace.vertices);
    this.solutionFaceVertexCount = solutionFace.vertexCount;
  }

  private applyStyledMarkers(styledMarkers: readonly StyledMarker[]): void {
    this.topologyVertexCount = styledMarkers.length;

    if (this.topologyVertexCount === 0) {
      return;
    }

    const requiredSize = this.topologyVertexCount * MARKER_INSTANCE_STRIDE;
    if (requiredSize > this.topologyVertexMarkerBuffer.size) {
      this.topologyVertexMarkerBuffer.destroy();
      this.topologyVertexMarkerBuffer = this.device.createBuffer({
        size: requiredSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
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

      markerData[offset + 22] = marker.vertexIndex;
    }

    this.device.queue.writeBuffer(this.topologyVertexMarkerBuffer, 0, markerData);
  }

  /**
   * Splits styled segments into regular lines (hidden/visible passes)
   * and topology edge segments (depth texture sampling pass).
   * Each segment is 32 floats (128 bytes) matching the shader LineInstance layout.
   */
  private applyStyledSegments(segments: readonly StyledSegment[]): void {
    this.styledLineCount = segments.length;

    if (this.styledLineCount === 0) {
      return;
    }

    const requiredSize = this.styledLineCount * STYLED_LINE_STRIDE;
    if (requiredSize > this.styledLineBuffer.size) {
      this.styledLineBuffer.destroy();
      this.styledLineBuffer = this.device.createBuffer({
        size: requiredSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
    }

    const instanceData = new Float32Array(this.styledLineCount * FLOATS_PER_STYLED_LINE);
    for (let index = 0; index < this.styledLineCount; index++) {
      writeSegmentInstance(instanceData, index, segments[index]);
    }
    this.device.queue.writeBuffer(this.styledLineBuffer, 0, instanceData);
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.previewUniformBuffer.destroy();
    this.faceVertexBuffer.destroy();
    this.solutionFaceBuffer.destroy();
    this.styledLineBuffer.destroy();
    this.topologyVertexMarkerBuffer.destroy();
    this.previewLineBuffer.destroy();
    this.previewStartMarkerBuffer.destroy();
    this.previewSnapMarkerBuffer.destroy();
    this.depthTexture?.destroy();
    this.samplingDepthTexture?.destroy();
    this.lineEndpointTexture?.destroy();
    this.lineDepthTexture?.destroy();
  }

  /**
   * Unprojects a screen-space position to a 3D point on the plane through
   * the reference position, perpendicular to the view direction.
   * Uses the reference position's clip-space Z to determine the depth.
   */
  private unprojectToVertexPlane(
    screenX: number,
    screenY: number,
    referencePosition: Vec3Array
  ): Vec3Array {
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

  private createLinePipeline(layout: GPUPipelineLayout, renderMode: number): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({ code: lineShaderSource });
    return this.device.createRenderPipeline({
      layout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: STYLED_LINE_STRIDE,
            stepMode: 'instance',
            attributes: STYLED_LINE_ATTRIBUTES,
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        constants: { renderMode },
        targets: [
          {
            format: this.format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less-equal',
        format: DEPTH_FORMAT,
      },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });
  }

  private createPreviewLinePipeline(layout: GPUPipelineLayout): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({ code: lineShaderSource });
    return this.device.createRenderPipeline({
      layout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: STYLED_LINE_STRIDE,
            stepMode: 'instance',
            attributes: STYLED_LINE_ATTRIBUTES,
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        constants: { renderMode: RENDER_MODE_ALL },
        targets: [
          {
            format: this.format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: 'always',
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

  private createSolutionFacePipeline(layout: GPUPipelineLayout): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({ code: solutionFaceShaderSource });

    return this.device.createRenderPipeline({
      layout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: SOLUTION_FACE_VERTEX_STRIDE,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
              { shaderLocation: 1, offset: 12, format: 'float32x4' }, // rgba
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
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: 'always',
        format: DEPTH_FORMAT,
      },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });
  }

  private createMarkerPipeline(
    layout: GPUPipelineLayout,
    renderMode: number,
    lineOcclusion = true
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
              { shaderLocation: 12, offset: 88, format: 'float32' }, // vertexIndex
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        constants: { renderMode, enableLineOcclusion: lineOcclusion ? 1 : 0 },
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

  private createLineIdPipeline(layout: GPUPipelineLayout, renderMode: number): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({ code: lineIdShaderSource });

    return this.device.createRenderPipeline({
      layout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: STYLED_LINE_STRIDE,
            stepMode: 'instance',
            attributes: LINE_ID_ATTRIBUTES,
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        constants: { renderMode },
        targets: [{ format: LINE_ENDPOINT_FORMAT }],
      },
      primitive: {
        topology: 'triangle-list',
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: DEPTH_FORMAT,
      },
    });
  }

  /**
   * Creates a 24-float marker instance for preview markers.
   * Uses the preview style for both visible and hidden fields since
   * preview markers render with renderMode=ALL and depthCompare: 'always'.
   */
  private createPreviewMarkerData(position: Vec3Array): Float32Array {
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

    const depthBindEntries = (buffer: GPUBuffer) => [
      { binding: 0, resource: { buffer } },
      { binding: 1, resource: depthTextureView },
      { binding: 2, resource: this.depthSampler },
    ];

    this.lineBindGroup = this.device.createBindGroup({
      layout: this.depthBindGroupLayout,
      entries: depthBindEntries(this.uniformBuffer),
    });

    this.previewLineBindGroup = this.device.createBindGroup({
      layout: this.depthBindGroupLayout,
      entries: depthBindEntries(this.previewUniformBuffer),
    });

    // Marker bind groups are created in ensureLineIdTextures (depends on both depth + line ID textures)

    return this.samplingDepthTexture.createView();
  }

  /**
   * Ensures non-MSAA line ID textures exist for topology-based marker occlusion.
   * Recreates marker bind groups when textures change size.
   */
  private ensureLineIdTextures(
    width: number,
    height: number,
    faceDepthView: GPUTextureView
  ): { endpointView: GPUTextureView; depthView: GPUTextureView } {
    const safeWidth = Math.max(MIN_DIMENSION, width);
    const safeHeight = Math.max(MIN_DIMENSION, height);

    if (
      !isNil(this.lineEndpointTexture) &&
      !isNil(this.lineDepthTexture) &&
      this.lineEndpointTexture.width === safeWidth &&
      this.lineEndpointTexture.height === safeHeight
    ) {
      return {
        endpointView: this.lineEndpointTexture.createView(),
        depthView: this.lineDepthTexture.createView(),
      };
    }

    this.lineEndpointTexture?.destroy();
    this.lineDepthTexture?.destroy();

    this.lineEndpointTexture = this.device.createTexture({
      size: [safeWidth, safeHeight],
      format: LINE_ENDPOINT_FORMAT,
      sampleCount: 1,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.lineDepthTexture = this.device.createTexture({
      size: [safeWidth, safeHeight],
      format: DEPTH_FORMAT,
      sampleCount: 1,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    const endpointView = this.lineEndpointTexture.createView();
    const lineDepthView = this.lineDepthTexture.createView();

    const markerBindEntries = (buffer: GPUBuffer) => [
      { binding: 0, resource: { buffer } },
      { binding: 1, resource: faceDepthView },
      { binding: 2, resource: this.depthSampler },
      { binding: 3, resource: endpointView },
      { binding: 4, resource: lineDepthView },
    ];

    this.markerBindGroup = this.device.createBindGroup({
      layout: this.markerBindGroupLayout,
      entries: markerBindEntries(this.uniformBuffer),
    });

    this.previewMarkerBindGroup = this.device.createBindGroup({
      layout: this.markerBindGroupLayout,
      entries: markerBindEntries(this.previewUniformBuffer),
    });

    return { endpointView, depthView: lineDepthView };
  }
}

function writeSegmentInstance(buffer: Float32Array, index: number, segment: StyledSegment): void {
  const offset = index * FLOATS_PER_STYLED_LINE;

  buffer[offset] = segment.startPosition[0];
  buffer[offset + 1] = segment.startPosition[1];
  buffer[offset + 2] = segment.startPosition[2];
  buffer[offset + 3] = segment.endPosition[0];
  buffer[offset + 4] = segment.endPosition[1];
  buffer[offset + 5] = segment.endPosition[2];

  buffer[offset + 6] = segment.visibleStyle.width;
  buffer[offset + 7] = segment.visibleStyle.color[0];
  buffer[offset + 8] = segment.visibleStyle.color[1];
  buffer[offset + 9] = segment.visibleStyle.color[2];
  buffer[offset + 10] = segment.visibleStyle.alpha;
  buffer[offset + 11] = segment.visibleStyle.lineType;
  buffer[offset + 12] = segment.visibleStyle.dash;
  buffer[offset + 13] = segment.visibleStyle.gap;

  buffer[offset + 14] = segment.hiddenStyle.width;
  buffer[offset + 15] = segment.hiddenStyle.color[0];
  buffer[offset + 16] = segment.hiddenStyle.color[1];
  buffer[offset + 17] = segment.hiddenStyle.color[2];
  buffer[offset + 18] = segment.hiddenStyle.alpha;
  buffer[offset + 19] = segment.hiddenStyle.lineType;
  buffer[offset + 20] = segment.hiddenStyle.dash;
  buffer[offset + 21] = segment.hiddenStyle.gap;

  buffer[offset + 22] = segment.startVertexIndex;
  buffer[offset + 23] = segment.endVertexIndex;
}
