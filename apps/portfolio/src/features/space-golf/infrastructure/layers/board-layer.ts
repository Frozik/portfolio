import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { MsaaTextureManager } from '@frozik/utils/webgpu/msaaTextureManager';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import { isNil } from 'lodash-es';

import {
  AIM_RING_RADIUS_METERS,
  BALL_RADIUS_METERS,
  BOARD_HEIGHT_METERS,
  BOARD_WIDTH_METERS,
} from '../../domain/constants';
import type { Level } from '../../domain/level';
import { MSAA_SAMPLE_COUNT } from '../render-constants';
import { fitBoard } from '../render/board-viewport';
import type { LevelMeshes } from '../render/level-geometry';
import { buildLevelMeshes } from '../render/level-geometry';
import type { MeshData } from '../render/mesh-writer';
import {
  MESH_COLOR_OFFSET_BYTES,
  MESH_VERTEX_STRIDE_BYTES,
  MeshWriter,
} from '../render/mesh-writer';
import { CLEAR_COLOR, PALETTE } from '../render/palette';
import type { ParticleField } from '../render/particles';
import { advanceParticles, createParticleField } from '../render/particles';
import { writePickup } from '../render/pickup-geometry';
import type { SceneFrame } from '../render/scene-frame';
import boardShaderSource from '../shaders/board.wgsl?raw';

const UNIFORM_BYTES = 32;
const UNIFORM_FLOATS = 8;
const PREVIEW_DOT_RADIUS_METERS = 0.045;
/** The burst: a ring growing from the ball's size to this radius while fading. */
const BURST_RADIUS_METERS = 0.6;
const BURST_RING_WIDTH_METERS = 0.08;
const BURST_SECONDS = 0.45;
const AIM_RING_WIDTH_METERS = 0.02;
/** Vertices the per-frame buffer can hold: ninety dust quads, or the ball, five dots, two rings and the pickups. */
const DYNAMIC_VERTEX_CAPACITY = 6144;
const QUAD_HALF = 0.5;
const ALPHA_MAX = 255;

interface GpuMesh {
  readonly buffer: GPUBuffer;
  readonly vertexCount: number;
}

/**
 * The whole board in one pass: stars, walls with their rims, the cup and the
 * flag are uploaded once per level; the spike rows twice, one buffer per
 * stroke parity; the ball, the aim dots and the burst are rewritten every
 * frame into a small buffer. Clears and resolves the multisampled target.
 */
export class BoardLayer implements RenderLayer {
  private device!: GPUDevice;
  private format!: GPUTextureFormat;
  private pipeline!: GPURenderPipeline;
  private uniforms!: GPUBuffer;
  private bindGroup!: GPUBindGroup;
  private dynamicBuffer!: GPUBuffer;
  private dynamicCount = 0;
  private dustBuffer!: GPUBuffer;
  private dustCount = 0;
  private meshes:
    | { readonly level: Level; readonly gpu: Record<keyof LevelMeshes, GpuMesh> }
    | undefined;
  private dust: ParticleField | undefined;
  private lastTime: number | undefined;

  constructor(
    private readonly msaaManager: MsaaTextureManager,
    private readonly getScene: () => SceneFrame | undefined
  ) {}

  init({ device, format }: GpuContext): void {
    this.device = device;
    this.format = format;
    const module = device.createShaderModule({ code: boardShaderSource });
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }],
    });
    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: {
        module,
        entryPoint: 'vsBoard',
        buffers: [
          {
            arrayStride: MESH_VERTEX_STRIDE_BYTES,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: MESH_COLOR_OFFSET_BYTES, format: 'unorm8x4' },
            ],
          },
        ],
      },
      fragment: {
        module,
        entryPoint: 'fsBoard',
        targets: [
          {
            format,
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
  }

  update(state: FrameState): void {
    const scene = this.getScene();
    if (isNil(scene)) {
      return;
    }
    if (this.meshes?.level !== scene.level) {
      this.replaceLevelMeshes(scene.level);
      this.dust = createParticleField(scene.level.seed, scene.level.width, scene.level.height);
    }
    const elapsed = this.lastTime === undefined ? 0 : state.time - this.lastTime;
    this.lastTime = state.time;
    if (!isNil(this.dust)) {
      this.dust = advanceParticles(
        this.dust,
        scene.ball.down,
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
      viewport.scale,
    ]);
    this.device.queue.writeBuffer(this.uniforms, 0, values);
    this.writeDust();
    this.writeDynamic(scene);
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
    if (!isNil(this.meshes) && !isNil(scene)) {
      // The dust is the far background: everything else is painted over it.
      if (this.dustCount > 0) {
        pass.setVertexBuffer(0, this.dustBuffer);
        pass.draw(this.dustCount);
      }
      const spikes =
        scene.displayedStroke % 2 === 1
          ? this.meshes.gpu.spikesOnOddStroke
          : this.meshes.gpu.spikesOnEvenStroke;
      for (const mesh of [this.meshes.gpu.stage, spikes]) {
        if (mesh.vertexCount > 0) {
          pass.setVertexBuffer(0, mesh.buffer);
          pass.draw(mesh.vertexCount);
        }
      }
      if (this.dynamicCount > 0) {
        pass.setVertexBuffer(0, this.dynamicBuffer);
        pass.draw(this.dynamicCount);
      }
    }
    pass.end();
  }

  dispose(): void {
    this.releaseLevelMeshes();
    this.uniforms.destroy();
    this.dynamicBuffer.destroy();
    this.dustBuffer.destroy();
  }

  private replaceLevelMeshes(level: Level): void {
    this.releaseLevelMeshes();
    const meshes = buildLevelMeshes(level);
    this.meshes = {
      level,
      gpu: {
        stage: this.upload(meshes.stage),
        spikesOnOddStroke: this.upload(meshes.spikesOnOddStroke),
        spikesOnEvenStroke: this.upload(meshes.spikesOnEvenStroke),
      },
    };
  }

  private releaseLevelMeshes(): void {
    if (isNil(this.meshes)) {
      return;
    }
    for (const mesh of Object.values(this.meshes.gpu)) {
      mesh.buffer.destroy();
    }
    this.meshes = undefined;
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

  /** The ball, the aim dots and the burst — drawn over the board. */
  /** The drifting dust, rewritten every frame into the buffer drawn first. */
  private writeDust(): void {
    const writer = new MeshWriter();
    for (const particle of this.dust?.particles ?? []) {
      const { x, y } = particle.position;
      const r = particle.radius * 2 * QUAD_HALF;
      writer.convexPolygon(
        [
          { x: x - r, y: y - r },
          { x: x + r, y: y - r },
          { x: x + r, y: y + r },
          { x: x - r, y: y + r },
        ],
        PALETTE.star
      );
    }
    const data = writer.finish();
    this.dustCount = Math.min(data.vertexCount, DYNAMIC_VERTEX_CAPACITY);
    if (this.dustCount > 0) {
      this.device.queue.writeBuffer(
        this.dustBuffer,
        0,
        data.vertexData,
        0,
        this.dustCount * MESH_VERTEX_STRIDE_BYTES
      );
    }
  }

  private writeDynamic(scene: SceneFrame): void {
    const writer = new MeshWriter();
    scene.level.pickups.forEach((pickup, index) => {
      if (!scene.ball.collected.has(index)) {
        writePickup(writer, pickup, PALETTE.pickup);
      }
    });
    if (scene.aimRing && scene.ball.phase === 'aiming') {
      writer.ring(
        scene.ball.position,
        AIM_RING_RADIUS_METERS - AIM_RING_WIDTH_METERS / 2,
        AIM_RING_RADIUS_METERS + AIM_RING_WIDTH_METERS / 2,
        PALETTE.aimRing
      );
    }
    if (!isNil(scene.preview)) {
      for (const dot of scene.preview) {
        writer.circle(dot, PREVIEW_DOT_RADIUS_METERS, PALETTE.dot);
      }
    }
    if (!isNil(scene.burst)) {
      const progress = Math.min(1, scene.burst.elapsedSeconds / BURST_SECONDS);
      const radius = BALL_RADIUS_METERS + (BURST_RADIUS_METERS - BALL_RADIUS_METERS) * progress;
      const alpha = Math.round(ALPHA_MAX * (1 - progress));
      writer.ring(
        scene.burst.position,
        radius - BURST_RING_WIDTH_METERS / 2,
        radius + BURST_RING_WIDTH_METERS / 2,
        [PALETTE.burst[0], PALETTE.burst[1], PALETTE.burst[2], alpha]
      );
    } else if (scene.ball.phase !== 'holed') {
      writer.circle(scene.ball.position, BALL_RADIUS_METERS, PALETTE.ball);
    }
    const data = writer.finish();
    this.dynamicCount = Math.min(data.vertexCount, DYNAMIC_VERTEX_CAPACITY);
    if (this.dynamicCount > 0) {
      this.device.queue.writeBuffer(
        this.dynamicBuffer,
        0,
        data.vertexData,
        0,
        this.dynamicCount * MESH_VERTEX_STRIDE_BYTES
      );
    }
  }
}
