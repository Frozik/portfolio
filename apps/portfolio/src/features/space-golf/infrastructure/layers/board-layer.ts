import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { MsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';

import { currentGravity } from '../../domain/ball';
import { BOARD_HEIGHT_METERS, BOARD_WIDTH_METERS } from '../../domain/constants';
import type { Level } from '../../domain/level';
import { MSAA_SAMPLE_COUNT } from '../render-constants';
import type { PixelRect } from '../render/board-viewport';
import { boardPixelRect, fitBoard } from '../render/board-viewport';
import { buildFloaterMesh } from '../render/floater-geometry';
import { buildDustMesh, buildOverlayMesh } from '../render/frame-geometry';
import {
  FRAMED_KIND_OFFSET_BYTES,
  FRAMED_LOCAL_OFFSET_BYTES,
  FRAMED_VERTEX_STRIDE_BYTES,
} from '../render/framed-mesh-writer';
import type { LevelMeshes } from '../render/level-geometry';
import { buildLevelMeshes } from '../render/level-geometry';
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
/** Vertices the per-frame buffer can hold: ninety dust quads, or the ball, five dots and two rings. */
const DYNAMIC_VERTEX_CAPACITY = 6144;

interface GpuMesh {
  readonly buffer: GPUBuffer;
  readonly vertexCount: number;
}

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
  private dynamicBuffer!: GPUBuffer;
  private dynamicCount = 0;
  private dustBuffer!: GPUBuffer;
  private dustCount = 0;
  private rodBuffer!: GPUBuffer;
  private rodCount = 0;
  private stage:
    | { readonly level: Level; readonly gpu: Record<keyof LevelMeshes, GpuMesh> }
    | undefined;
  private spikes: StrokeMesh | undefined;
  private floaters: StrokeMesh | undefined;
  private dust: ParticleField | undefined;
  private lastTime: number | undefined;
  private scissor: PixelRect | undefined;

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
    this.dynamicBuffer = device.createBuffer({
      size: DYNAMIC_VERTEX_CAPACITY * MESH_VERTEX_STRIDE_BYTES,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.dustBuffer = device.createBuffer({
      size: DYNAMIC_VERTEX_CAPACITY * MESH_VERTEX_STRIDE_BYTES,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.rodBuffer = device.createBuffer({
      size: DYNAMIC_VERTEX_CAPACITY * MESH_VERTEX_STRIDE_BYTES,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }

  update(state: FrameState): void {
    const scene = this.getScene();
    if (isNil(scene)) {
      return;
    }
    if (this.stage?.level !== scene.level) {
      this.replaceStage(scene.level);
      this.dust = createParticleField(scene.level.seed, scene.level.width, scene.level.height);
    }
    this.spikes = this.followStates(this.spikes, scene.ball.spikes, states =>
      buildSpikeMesh(scene.level, states)
    );
    this.floaters = this.followStates(this.floaters, scene.ball.floaters, states =>
      buildFloaterMesh(scene.level, states)
    );
    const elapsed = this.lastTime === undefined ? 0 : state.time - this.lastTime;
    this.lastTime = state.time;
    if (!isNil(this.dust)) {
      this.dust = advanceParticles(
        this.dust,
        currentGravity(scene.ball),
        elapsed,
        scene.level.width,
        scene.level.height
      );
    }
    const viewport = fitBoard(
      { width: state.canvasWidth, height: state.canvasHeight },
      { width: BOARD_WIDTH_METERS, height: BOARD_HEIGHT_METERS }
    );
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
      state.time,
    ]);
    this.device.queue.writeBuffer(this.uniforms, 0, values);
    this.scissor = boardPixelRect(
      viewport,
      { width: BOARD_WIDTH_METERS, height: BOARD_HEIGHT_METERS },
      { width: state.canvasWidth, height: state.canvasHeight }
    );
    this.dustCount = this.writeDynamic(this.dustBuffer, buildDustMesh(this.dust ?? []));
    this.rodCount = this.writeDynamic(this.rodBuffer, buildRodMesh(scene.level, scene.ball.rods));
    this.dynamicCount = this.writeDynamic(this.dynamicBuffer, buildOverlayMesh(scene));
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
    if (!isNil(this.stage) && !isNil(scene) && !isNil(this.scissor)) {
      // The board is the screen: the blocks bleeding past its edge and a
      // ball on its way out are cut off there, as the original's arena is.
      pass.setScissorRect(this.scissor.x, this.scissor.y, this.scissor.width, this.scissor.height);
      // The dust is the far background: everything else is painted over it.
      if (this.dustCount > 0) {
        pass.setVertexBuffer(0, this.dustBuffer);
        pass.draw(this.dustCount);
      }
      // The rods go under the islands: what is still inside a wall is hidden by it.
      if (this.rodCount > 0) {
        pass.setVertexBuffer(0, this.rodBuffer);
        pass.draw(this.rodCount);
      }
      if (this.stage.gpu.fill.vertexCount > 0) {
        pass.setPipeline(this.fillPipeline);
        pass.setVertexBuffer(0, this.stage.gpu.fill.buffer);
        pass.draw(this.stage.gpu.fill.vertexCount);
        pass.setPipeline(this.pipeline);
      }
      if (this.stage.gpu.decor.vertexCount > 0) {
        pass.setVertexBuffer(0, this.stage.gpu.decor.buffer);
        pass.draw(this.stage.gpu.decor.vertexCount);
      }
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
      if (this.stage.gpu.surfaces.vertexCount > 0) {
        pass.setPipeline(this.surfacePipeline);
        pass.setVertexBuffer(0, this.stage.gpu.surfaces.buffer);
        pass.draw(this.stage.gpu.surfaces.vertexCount);
        pass.setPipeline(this.pipeline);
      }
      if (this.dynamicCount > 0) {
        pass.setVertexBuffer(0, this.dynamicBuffer);
        pass.draw(this.dynamicCount);
      }
    }
    pass.end();
  }

  dispose(): void {
    this.releaseStage();
    this.spikes?.gpu.buffer.destroy();
    this.floaters?.gpu.buffer.destroy();
    this.spikes = undefined;
    this.floaters = undefined;
    this.uniforms.destroy();
    this.dynamicBuffer.destroy();
    this.dustBuffer.destroy();
    this.rodBuffer.destroy();
  }

  private replaceStage(level: Level): void {
    this.releaseStage();
    const meshes = buildLevelMeshes(level);
    this.stage = {
      level,
      gpu: {
        fill: this.upload(meshes.fill),
        decor: this.upload(meshes.decor),
        surfaces: this.upload(meshes.surfaces),
      },
    };
  }

  private releaseStage(): void {
    if (isNil(this.stage)) {
      return;
    }
    for (const mesh of Object.values(this.stage.gpu)) {
      mesh.buffer.destroy();
    }
    this.stage = undefined;
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

  /** Rewrites a per-frame buffer, capped at its capacity; the count of vertices to draw. */
  private writeDynamic(buffer: GPUBuffer, data: MeshData): number {
    const count = Math.min(data.vertexCount, DYNAMIC_VERTEX_CAPACITY);
    if (count > 0) {
      this.device.queue.writeBuffer(
        buffer,
        0,
        data.vertexData,
        0,
        count * MESH_VERTEX_STRIDE_BYTES
      );
    }
    return count;
  }
}
