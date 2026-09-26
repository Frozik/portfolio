import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { DepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';
import { createDepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';
import type { GpuMesh } from '@frozik/utils/webgpu/gpuMesh';
import { bindGpuMesh } from '@frozik/utils/webgpu/gpuMesh';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';

import { BUILDING_RISE_SECONDS, MAX_BUILDING_TILES_PER_FRAME } from '../../domain/constants';
import type { BuildingMeshCache } from '../building-mesh-cache';
import buildingsShaderSource from '../shaders/buildings.wgsl?raw';
import { FOG_COLOR } from './fog';
import type { MapFrame } from './map-frame';

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';
const SINGLE_SAMPLE = 1;
const FLOATS_PER_PLACEMENT = 4;
const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
const VERTEX_STRIDE_BYTES = 3 * FLOAT_BYTES;
/** From the south-west and high, so east and north walls read darker than the roofs. */
const SUN_DIRECTION = normalized([-0.45, 0.8, 0.4]);

function normalized([x, y, z]: readonly [number, number, number]): readonly [
  number,
  number,
  number,
] {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

interface BuildingDraw {
  readonly mesh: GpuMesh;
  readonly placementIndex: number;
}

/**
 * The building boxes over the raster ground: one lit, fogged draw per z14
 * tile, placed by an offset and a metres-to-units scale so the vertex
 * buffers stay in metres from the tile corner and never change. Drawn after
 * the ground with its own depth buffer, which the ground never writes —
 * every box stands above the plane, so only the boxes need to occlude each
 * other.
 */
export class MapBuildingLayer implements RenderLayer {
  private readonly device: GPUDevice;
  private readonly pipeline: GPURenderPipeline;
  private readonly bindGroup: GPUBindGroup;
  private readonly uniformBuffer: GPUBuffer;
  private readonly uniformView: StructuredView;
  private readonly placementBuffer: GPUBuffer;
  private readonly placementData = new Float32Array(
    MAX_BUILDING_TILES_PER_FRAME * FLOATS_PER_PLACEMENT
  );
  private readonly depth: DepthTextureManager;
  private draws: readonly BuildingDraw[] = [];

  constructor(
    context: GpuContext,
    private readonly cache: BuildingMeshCache,
    /** The frame the ground layer produced this tick, or nothing when the picture is unchanged. */
    private readonly readFrame: () => MapFrame | undefined
  ) {
    this.device = context.device;
    this.depth = createDepthTextureManager(SINGLE_SAMPLE, DEPTH_FORMAT);

    const definitions = makeShaderDataDefinitions(buildingsShaderSource);
    this.uniformView = makeStructuredView(definitions.uniforms.U);
    this.uniformBuffer = this.device.createBuffer({
      size: this.uniformView.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.placementBuffer = this.device.createBuffer({
      size: this.placementData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = this.device.createShaderModule({ code: buildingsShaderSource });
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: VERTEX_STRIDE_BYTES,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
          },
          {
            arrayStride: VERTEX_STRIDE_BYTES,
            attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }],
          },
        ],
      },
      fragment: { module: shaderModule, entryPoint: 'fs', targets: [{ format: context.format }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
    });
    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.placementBuffer } },
      ],
    });
  }

  update(): void {
    const frame = this.readFrame();
    if (frame === undefined) {
      return;
    }
    const draws: BuildingDraw[] = [];
    for (const placement of frame.buildings) {
      const mesh = this.cache.meshOf(placement.key);
      if (mesh === undefined || draws.length >= MAX_BUILDING_TILES_PER_FRAME) {
        continue;
      }
      const base = draws.length * FLOATS_PER_PLACEMENT;
      this.placementData[base] = placement.offsetX;
      this.placementData[base + 1] = placement.offsetZ;
      this.placementData[base + 2] = placement.scale;
      this.placementData[base + 3] = placement.riseStart;
      draws.push({ mesh, placementIndex: draws.length });
    }
    this.draws = draws;
    if (draws.length === 0) {
      return;
    }
    this.uniformView.set({
      viewProjection: frame.viewProjection,
      cameraPosition: [frame.cameraPosition.x, frame.cameraPosition.y, frame.cameraPosition.z],
      fogStart: frame.fogStart,
      fogColor: [FOG_COLOR.r, FOG_COLOR.g, FOG_COLOR.b],
      fogEnd: frame.fogEnd,
      sunDirection: SUN_DIRECTION,
      time: frame.time,
      riseSeconds: BUILDING_RISE_SECONDS,
    });
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformView.arrayBuffer);
    this.device.queue.writeBuffer(
      this.placementBuffer,
      0,
      this.placementData,
      0,
      draws.length * FLOATS_PER_PLACEMENT
    );
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView, state: FrameState): void {
    if (this.draws.length === 0) {
      return;
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: canvasView, loadOp: 'load', storeOp: 'store' }],
      depthStencilAttachment: {
        view: this.depth.ensureView(this.device, state.canvasWidth, state.canvasHeight),
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard',
      },
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    for (const { mesh, placementIndex } of this.draws) {
      bindGpuMesh(pass, mesh);
      pass.drawIndexed(mesh.indexCount, 1, 0, 0, placementIndex);
    }
    pass.end();
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.placementBuffer.destroy();
    this.depth.dispose();
  }
}
