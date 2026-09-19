import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { MsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';

import { currentGravity } from '../../domain/ball';
import { CLOCK_SPEED } from '../../domain/constants';
import { MSAA_SAMPLE_COUNT } from '../render-constants';
import { DynamicVertexBuffer } from '../render/dynamic-vertex-buffer';
import { buildFloaterMesh } from '../render/floater-geometry';
import { buildDustMesh, buildOverlayMesh } from '../render/frame-geometry';
import {
  FRAMED_KIND_OFFSET_BYTES,
  FRAMED_LOCAL_OFFSET_BYTES,
  FRAMED_VERTEX_STRIDE_BYTES,
} from '../render/framed-mesh-writer';
import type { MeshData } from '../render/mesh-writer';
import { MESH_COLOR_OFFSET_BYTES, MESH_VERTEX_STRIDE_BYTES } from '../render/mesh-writer';
import { CLEAR_COLOR } from '../render/palette';
import type { ParticleField } from '../render/particles';
import { advanceParticles, createParticleField } from '../render/particles';
import { buildRodMesh } from '../render/rod-geometry';
import type { SceneFrame } from '../render/scene-frame';
import { buildSpikeMesh } from '../render/spike-geometry';
import boardShaderSource from '../shaders/board.wgsl?raw';
import khokhlomaShaderSource from '../shaders/khokhloma.wgsl?raw';
import mezenShaderSource from '../shaders/mezen.wgsl?raw';
import surfacesShaderSource from '../shaders/surfaces.wgsl?raw';
import type { GpuMesh } from './sector-mesh-cache';
import { SectorMeshCache } from './sector-mesh-cache';

const UNIFORM_BYTES = 48;
const UNIFORM_FLOATS = 12;
const MESH_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: MESH_VERTEX_STRIDE_BYTES,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x2' },
    { shaderLocation: 1, offset: MESH_COLOR_OFFSET_BYTES, format: 'unorm8x4' },
  ],
};
const FRAMED_LAYOUT: GPUVertexBufferLayout = {
  arrayStride: FRAMED_VERTEX_STRIDE_BYTES,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x2' },
    { shaderLocation: 1, offset: FRAMED_LOCAL_OFFSET_BYTES, format: 'float32x4' },
    { shaderLocation: 2, offset: FRAMED_KIND_OFFSET_BYTES, format: 'unorm8x4' },
  ],
};
/** The pattern is shifted per level by this many metres per seed step, folded so the shift stays small. */
const PATTERN_SHIFT_METERS_PER_SEED = 1.37;
const PATTERN_SHIFT_PERIOD_SEEDS = 97;
/**
 * Room the per-frame buffers start with — ninety dust quads, or an overlay of
 * the ball with its trail, the dots and the rings. The drawn bow alone is over
 * five thousand vertices, so an overlay carrying one grows past this; the
 * buffer grows with it rather than cutting the frame short.
 */
const INITIAL_DYNAMIC_VERTEX_CAPACITY = 6144;
/** The dust lives in what the camera shows and this much more, so none pops in at the edge. */
const DUST_MARGIN_METERS = 2;

/** A mesh that follows one per-stroke state array: rebuilt when the array is replaced, once per stroke. */
interface StrokeMesh {
  readonly states: readonly boolean[];
  readonly gpu: GpuMesh;
}

/**
 * The whole board in one pass: the walls with their rims are uploaded once
 * per level; the dust, the ball, the aim dots and the burst are rewritten
 * every frame into small buffers. Clears and resolves the multisampled target.
 */
export class BoardLayer implements RenderLayer {
  private device!: GPUDevice;
  private format!: GPUTextureFormat;
  private pipeline!: GPURenderPipeline;
  private fillPipeline!: GPURenderPipeline;
  private surfacePipeline!: GPURenderPipeline;
  private floaterPipeline!: GPURenderPipeline;
  private uniforms!: GPUBuffer;
  private bindGroup!: GPUBindGroup;
  private overlayVertices!: DynamicVertexBuffer;
  private overlayCount = 0;
  private dustVertices!: DynamicVertexBuffer;
  private dustCount = 0;
  private rodVertices!: DynamicVertexBuffer;
  private rodCount = 0;
  private readonly sectors = new SectorMeshCache(data => this.upload(data));
  private spikes: StrokeMesh | undefined;
  private floaters: StrokeMesh | undefined;
  private dust: ParticleField | undefined;
  private lastTime: number | undefined;

  constructor(
    private readonly msaaManager: MsaaTextureManager,
    private readonly getScene: () => SceneFrame | undefined
  ) {}

  init({ device, format }: GpuContext): void {
    this.device = device;
    this.format = format;
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
    this.pipeline = this.createPipeline(
      layout,
      boardShaderSource,
      'vsBoard',
      'fsBoard',
      MESH_LAYOUT
    );
    this.fillPipeline = this.createPipeline(
      layout,
      khokhlomaShaderSource,
      'vsBoard',
      'fsKhokhloma',
      MESH_LAYOUT
    );
    this.surfacePipeline = this.createPipeline(
      layout,
      surfacesShaderSource,
      'vsSurface',
      'fsSurface',
      FRAMED_LAYOUT
    );
    this.floaterPipeline = this.createPipeline(
      layout,
      mezenShaderSource,
      'vsMezen',
      'fsMezen',
      FRAMED_LAYOUT
    );
    this.uniforms = device.createBuffer({
      size: UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.uniforms } }],
    });
    const perFrame = {
      device,
      strideBytes: MESH_VERTEX_STRIDE_BYTES,
      initialVertices: INITIAL_DYNAMIC_VERTEX_CAPACITY,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    };
    this.overlayVertices = new DynamicVertexBuffer(perFrame);
    this.dustVertices = new DynamicVertexBuffer(perFrame);
    this.rodVertices = new DynamicVertexBuffer(perFrame);
  }

  update(state: FrameState): void {
    const scene = this.getScene();
    if (isNil(scene)) {
      return;
    }
    this.sectors.sync(scene.slices);
    const dustWindow = {
      min: {
        x: scene.visible.min.x - DUST_MARGIN_METERS,
        y: scene.visible.min.y - DUST_MARGIN_METERS,
      },
      max: {
        x: scene.visible.max.x + DUST_MARGIN_METERS,
        y: scene.visible.max.y + DUST_MARGIN_METERS,
      },
    };
    this.dust ??= createParticleField(scene.level.seed, dustWindow);
    this.spikes = this.followStates(this.spikes, scene.ball.spikes, states =>
      buildSpikeMesh(scene.level, states)
    );
    this.floaters = this.followStates(this.floaters, scene.ball.floaters, states =>
      buildFloaterMesh(scene.level, states)
    );
    const elapsed = this.lastTime === undefined ? 0 : (state.time - this.lastTime) * CLOCK_SPEED;
    this.lastTime = state.time;
    this.dust = advanceParticles(this.dust, currentGravity(scene.ball), elapsed, dustWindow);
    const { viewport } = scene;
    const values = new Float32Array(UNIFORM_FLOATS);
    values.set([
      state.canvasWidth,
      state.canvasHeight,
      viewport.origin.x,
      viewport.origin.y,
      viewport.xAxis.x,
      viewport.xAxis.y,
      viewport.yAxis.x,
      viewport.yAxis.y,
      viewport.scale,
      (scene.level.seed % PATTERN_SHIFT_PERIOD_SEEDS) * PATTERN_SHIFT_METERS_PER_SEED,
      state.time * CLOCK_SPEED,
    ]);
    this.device.queue.writeBuffer(this.uniforms, 0, values);
    this.dustCount = this.dustVertices.write(buildDustMesh(this.dust));
    this.rodCount = this.rodVertices.write(
      buildRodMesh(scene.level, scene.ball.rods, scene.visible)
    );
    this.overlayCount = this.overlayVertices.write(
      buildOverlayMesh(scene, state.time * CLOCK_SPEED)
    );
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
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: msaaView,
          resolveTarget: canvasView,
          loadOp: 'clear',
          clearValue: CLEAR_COLOR,
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    const scene = this.getScene();
    if (!isNil(scene)) {
      const shown = this.sectors.within(scene.visible);
      // The dust is the far background: everything else is painted over it.
      if (this.dustCount > 0) {
        pass.setVertexBuffer(0, this.dustVertices.buffer);
        pass.draw(this.dustCount);
      }
      // The rods go under the islands: what is still inside a wall is hidden by it.
      if (this.rodCount > 0) {
        pass.setVertexBuffer(0, this.rodVertices.buffer);
        pass.draw(this.rodCount);
      }
      pass.setPipeline(this.fillPipeline);
      this.drawEach(
        pass,
        shown.map(meshes => meshes.fill)
      );
      pass.setPipeline(this.pipeline);
      this.drawEach(
        pass,
        shown.map(meshes => meshes.decor)
      );
      if (!isNil(this.spikes) && this.spikes.gpu.vertexCount > 0) {
        pass.setVertexBuffer(0, this.spikes.gpu.buffer);
        pass.draw(this.spikes.gpu.vertexCount);
      }
      if (!isNil(this.floaters) && this.floaters.gpu.vertexCount > 0) {
        pass.setPipeline(this.floaterPipeline);
        pass.setVertexBuffer(0, this.floaters.gpu.buffer);
        pass.draw(this.floaters.gpu.vertexCount);
        pass.setPipeline(this.pipeline);
      }
      pass.setPipeline(this.surfacePipeline);
      this.drawEach(
        pass,
        shown.map(meshes => meshes.surfaces)
      );
      pass.setPipeline(this.pipeline);
      if (this.overlayCount > 0) {
        pass.setVertexBuffer(0, this.overlayVertices.buffer);
        pass.draw(this.overlayCount);
      }
    }
    pass.end();
  }

  dispose(): void {
    this.sectors.dispose();
    this.spikes?.gpu.buffer.destroy();
    this.floaters?.gpu.buffer.destroy();
    this.spikes = undefined;
    this.floaters = undefined;
    this.uniforms.destroy();
    this.overlayVertices.destroy();
    this.dustVertices.destroy();
    this.rodVertices.destroy();
  }

  private drawEach(pass: GPURenderPassEncoder, meshes: readonly GpuMesh[]): void {
    for (const mesh of meshes) {
      if (mesh.vertexCount > 0) {
        pass.setVertexBuffer(0, mesh.buffer);
        pass.draw(mesh.vertexCount);
      }
    }
  }

  private followStates(
    mesh: StrokeMesh | undefined,
    states: readonly boolean[],
    build: (states: readonly boolean[]) => MeshData
  ): StrokeMesh {
    if (mesh?.states === states) {
      return mesh;
    }
    mesh?.gpu.buffer.destroy();
    return { states, gpu: this.upload(build(states)) };
  }

  /** Every pipeline shares the uniforms, the blend and the multisampling; the shader and the vertex layout differ. */
  private createPipeline(
    layout: GPUPipelineLayout,
    code: string,
    vertexEntryPoint: string,
    fragmentEntryPoint: string,
    vertexLayout: GPUVertexBufferLayout
  ): GPURenderPipeline {
    const module = this.device.createShaderModule({ code });
    return this.device.createRenderPipeline({
      layout,
      vertex: { module, entryPoint: vertexEntryPoint, buffers: [vertexLayout] },
      fragment: {
        module,
        entryPoint: fragmentEntryPoint,
        targets: [
          {
            format: this.format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list' },
      multisample: { count: MSAA_SAMPLE_COUNT },
    });
  }

  private upload(data: MeshData): GpuMesh {
    const buffer = this.device.createBuffer({
      size: Math.max(MESH_VERTEX_STRIDE_BYTES, data.vertexData.byteLength),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    if (data.vertexCount > 0) {
      this.device.queue.writeBuffer(buffer, 0, data.vertexData);
    }
    return { buffer, vertexCount: data.vertexCount };
  }
}
