import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { FpsController } from '@frozik/utils/webgpu/fpsController';
import type { MsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';

import { resolveBackgroundColor, styleScene } from '../../application/render/styled-scene';
import {
  DEPTH_FADE_MIN,
  DEPTH_FADE_RATE,
  FPS_ANIMATION,
  VERTICES_PER_LINE_QUAD,
} from '../../domain/constants';
import { createWireframeFromTopology } from '../../domain/geometry';
import type { SceneRepresentation } from '../../domain/render-types';
import type { FigureTopology, Vec3Array } from '../../domain/topology-types';
import type { CameraProjection } from '../../domain/types';
import { unprojectToReferencePlane } from '../../domain/unproject';
import type { OrbitalCameraController } from '../camera-controller';
import type { DragPreviewState } from '../drag-connector-types';
import type { PreviewLine } from '../render/drag-preview';
import { InstanceBuffer } from '../render/instance-buffer';
import { PreviewBuffers } from '../render/preview-buffers';
import type { SceneBindGroups } from '../render/scene-bind-groups';
import { createSceneBindGroups, isSameViews } from '../render/scene-bind-groups';
import { SceneFrame } from '../render/scene-frame';
import {
  MARKER_INSTANCE_STRIDE,
  packStyledMarkers,
  packStyledSegments,
  SOLUTION_FACE_VERTEX_STRIDE,
  STYLED_LINE_STRIDE,
} from '../render/scene-instances';
import type { ScenePipelines } from '../render/scene-pipelines';
import { createScenePipelines } from '../render/scene-pipelines';
import type { SceneTargetViews } from '../render/scene-targets';
import { SceneTargets } from '../render/scene-targets';
import { SceneUniforms } from '../render/scene-uniforms';

const VERTICES_PER_MARKER_QUAD = 6;
const LINE_ID_SENTINEL_CLEAR: GPUColor = { r: -1, g: -1, b: 0, a: 0 };
const VERTEX_BUFFER_USAGE = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;

/**
 * Sequences the stereometry passes for one frame:
 *
 * 1. Depth pre-pass: solid faces into a non-MSAA depth texture the later passes sample.
 * 2. Hidden line-id pass: endpoint indices of occluded lines, for the marker topology check.
 * 3. Hidden pass (MSAA, colour cleared): solution face, occluded lines, occluded markers.
 * 4. Visible line-id pass: endpoint indices of visible lines.
 * 5. Visible pass (MSAA, colour kept): visible lines and markers, then the drag preview on top.
 */
export class SceneLayer implements RenderLayer {
  private device!: GPUDevice;
  private format!: GPUTextureFormat;
  private pipelines!: ScenePipelines;
  private uniforms!: SceneUniforms;
  private depthSampler!: GPUSampler;
  private uniformBindGroup!: GPUBindGroup;
  private bindGroups: SceneBindGroups | undefined;
  private boundViews: SceneTargetViews | undefined;
  private readonly targets = new SceneTargets();

  private faceVertexBuffer!: GPUBuffer;
  private faceVertexCount = 0;
  private solutionFaceBuffer!: InstanceBuffer;
  private solutionFaceVertexCount = 0;
  private styledLineBuffer!: InstanceBuffer;
  private styledLineCount = 0;
  private markerBuffer!: InstanceBuffer;
  private markerCount = 0;
  private previewBuffers!: PreviewBuffers;

  /** Set dirty by scene/preview/camera/viewport changes; consumed by the render loop to skip idle frames. */
  private readonly frame = new SceneFrame();

  private readonly backgroundClearColor = resolveBackgroundColor();

  constructor(
    private readonly camera: OrbitalCameraController,
    private readonly msaaManager: MsaaTextureManager,
    private readonly topology: FigureTopology,
    private readonly fpsController: FpsController,
    private readonly sceneCenter: Vec3Array,
    private readonly projection: CameraProjection = 'perspective'
  ) {}

  init(context: GpuContext): void {
    this.device = context.device;
    this.format = context.format;

    const wireframe = createWireframeFromTopology(this.topology);
    this.faceVertexCount = wireframe.faceVertexCount;
    this.faceVertexBuffer = this.device.createBuffer({
      size: wireframe.facePositions.byteLength,
      usage: VERTEX_BUFFER_USAGE,
    });
    this.device.queue.writeBuffer(this.faceVertexBuffer, 0, wireframe.facePositions);

    this.solutionFaceBuffer = new InstanceBuffer(this.device, SOLUTION_FACE_VERTEX_STRIDE);
    this.styledLineBuffer = new InstanceBuffer(this.device, STYLED_LINE_STRIDE);
    this.markerBuffer = new InstanceBuffer(this.device, MARKER_INSTANCE_STRIDE);
    this.previewBuffers = new PreviewBuffers(this.device);

    this.uniforms = new SceneUniforms(this.device);
    this.pipelines = createScenePipelines(this.device, this.format);
    this.depthSampler = this.device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' });
    this.uniformBindGroup = this.device.createBindGroup({
      layout: this.pipelines.uniformBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniforms.buffer } }],
    });
  }

  update(state: FrameState): void {
    const isAnimating = this.camera.tick();
    if (isAnimating) {
      this.fpsController.raise(FPS_ANIMATION);
    }

    const frame = this.frame.advance(state, this.camera, this.projection, isAnimating);
    if (isNil(frame)) {
      return;
    }

    const { mvpMatrix, viewMatrix, cameraDistance } = frame;
    this.uniforms.write({
      mvp: mvpMatrix,
      viewport: [state.canvasWidth, state.canvasHeight],
      dpr: state.devicePixelRatio,
      cameraDistance,
      // Camera forward direction: the negated Z axis of the view matrix.
      cameraForward: [-viewMatrix[2], -viewMatrix[6], -viewMatrix[10]],
      cameraTarget: this.sceneCenter,
      depthFadeRate: DEPTH_FADE_RATE,
      depthFadeMin: DEPTH_FADE_MIN,
    });
  }

  /** Whether anything changed since the last consumed frame; resets the flag (render-on-demand). */
  consumeDirty(): boolean {
    return this.frame.consumeDirty();
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

    const views = this.targets.ensure(this.device, state.canvasWidth, state.canvasHeight);
    this.bindTargets(views);

    this.encodeDepthPrePass(encoder, views);

    // The line-id passes only feed the marker topology check.
    const lineIdPassNeeded = this.styledLineCount > 0 && this.markerCount > 0;
    if (lineIdPassNeeded) {
      this.encodeLineIdPass(encoder, views, this.pipelines.hiddenLineId);
    }
    this.encodeHiddenPass(encoder, msaaView, views.depth);
    if (lineIdPassNeeded) {
      this.encodeLineIdPass(encoder, views, this.pipelines.visibleLineId);
    }
    this.encodeVisiblePass(encoder, msaaView, canvasView, views.depth);
  }

  /** The bind groups reference the target views, so a resize rebuilds them. */
  private bindTargets(views: SceneTargetViews): void {
    if (this.boundViews === views || isSameViews(this.boundViews, views)) {
      return;
    }
    this.boundViews = views;
    this.bindGroups = createSceneBindGroups(
      this.device,
      this.pipelines,
      this.uniforms.buffer,
      this.depthSampler,
      views
    );
  }

  private encodeDepthPrePass(encoder: GPUCommandEncoder, views: SceneTargetViews): void {
    const pass = encoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: views.faceDepth,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });
    pass.setPipeline(this.pipelines.depthPrePass);
    pass.setBindGroup(0, this.uniformBindGroup);
    pass.setVertexBuffer(0, this.faceVertexBuffer);
    pass.draw(this.faceVertexCount);
    pass.end();
  }

  private encodeLineIdPass(
    encoder: GPUCommandEncoder,
    views: SceneTargetViews,
    pipeline: GPURenderPipeline
  ): void {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: views.lineEndpoint,
          clearValue: LINE_ID_SENTINEL_CLEAR,
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: views.lineDepth,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });
    this.drawLines(pass, pipeline, this.styledLineBuffer.handle, this.styledLineCount);
    pass.end();
  }

  private encodeHiddenPass(
    encoder: GPUCommandEncoder,
    msaaView: GPUTextureView,
    depthView: GPUTextureView
  ): void {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: msaaView,
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

    // The solution face goes first: a blended region behind the wireframe.
    if (this.solutionFaceVertexCount > 0) {
      pass.setPipeline(this.pipelines.solutionFace);
      pass.setBindGroup(0, this.uniformBindGroup);
      pass.setVertexBuffer(0, this.solutionFaceBuffer.handle);
      pass.draw(this.solutionFaceVertexCount);
    }
    this.drawLines(
      pass,
      this.pipelines.hiddenLine,
      this.styledLineBuffer.handle,
      this.styledLineCount
    );
    this.drawMarkers(pass, this.pipelines.hiddenMarker, this.markerBuffer.handle, this.markerCount);
    pass.end();
  }

  private encodeVisiblePass(
    encoder: GPUCommandEncoder,
    msaaView: GPUTextureView,
    canvasView: GPUTextureView,
    depthView: GPUTextureView
  ): void {
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        { view: msaaView, resolveTarget: canvasView, loadOp: 'load', storeOp: 'discard' },
      ],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard',
      },
    });

    this.drawLines(
      pass,
      this.pipelines.visibleLine,
      this.styledLineBuffer.handle,
      this.styledLineCount
    );
    this.drawMarkers(
      pass,
      this.pipelines.visibleMarker,
      this.markerBuffer.handle,
      this.markerCount
    );

    if (!isNil(this.previewBuffers.previewLine)) {
      this.drawLines(pass, this.pipelines.previewLine, this.previewBuffers.line, 1);
    }
    if (this.previewBuffers.hasStartMarker) {
      this.drawMarkers(pass, this.pipelines.previewMarker, this.previewBuffers.startMarker, 1);
    }
    if (this.previewBuffers.hasSnapTarget) {
      this.drawMarkers(pass, this.pipelines.previewMarker, this.previewBuffers.snapMarker, 1);
    }
    pass.end();
  }

  private drawLines(
    pass: GPURenderPassEncoder,
    pipeline: GPURenderPipeline,
    buffer: GPUBuffer,
    instanceCount: number
  ): void {
    if (instanceCount === 0 || isNil(this.bindGroups)) {
      return;
    }
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, this.bindGroups.line);
    pass.setVertexBuffer(0, buffer);
    pass.draw(VERTICES_PER_LINE_QUAD, instanceCount);
  }

  private drawMarkers(
    pass: GPURenderPassEncoder,
    pipeline: GPURenderPipeline,
    buffer: GPUBuffer,
    instanceCount: number
  ): void {
    if (instanceCount === 0 || isNil(this.bindGroups)) {
      return;
    }
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, this.bindGroups.marker);
    pass.setVertexBuffer(0, buffer);
    pass.draw(VERTICES_PER_MARKER_QUAD, instanceCount);
  }

  getPreviewLine(): PreviewLine | undefined {
    return this.previewBuffers.previewLine;
  }

  /** Resolves the drag preview against the last drawn camera and uploads its line and markers. */
  setDragPreview(preview: DragPreviewState | undefined): void {
    this.frame.markDirty();
    this.previewBuffers.apply(preview, (screenX, screenY, reference) =>
      unprojectToReferencePlane(
        this.frame.mvpMatrix,
        this.frame.viewport,
        screenX,
        screenY,
        reference
      )
    );
  }

  /** Styles the scene and uploads segments, markers and the solution face. */
  applySceneState(representation: SceneRepresentation): void {
    const { markers, segments, solutionFace } = styleScene(representation);
    this.frame.markDirty();

    this.markerCount = markers.length;
    if (markers.length > 0) {
      this.markerBuffer.write(packStyledMarkers(markers));
    }
    this.styledLineCount = segments.length;
    if (segments.length > 0) {
      this.styledLineBuffer.write(packStyledSegments(segments));
    }
    this.solutionFaceVertexCount = solutionFace?.vertexCount ?? 0;
    if (!isNil(solutionFace) && solutionFace.vertexCount > 0) {
      this.solutionFaceBuffer.write(solutionFace.vertices);
    }
  }

  dispose(): void {
    this.uniforms.dispose();
    this.faceVertexBuffer.destroy();
    this.solutionFaceBuffer.dispose();
    this.styledLineBuffer.dispose();
    this.markerBuffer.dispose();
    this.previewBuffers.dispose();
    this.targets.dispose();
  }
}
