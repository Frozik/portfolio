import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { GpuMesh } from '@frozik/utils/webgpu/gpuMesh';
import { bindGpuMesh } from '@frozik/utils/webgpu/gpuMesh';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';

import { BUILDING_RISE_SECONDS, MAX_BUILDING_TILES_PER_FRAME } from '../../domain/constants';
import { waveFieldAround } from '../../domain/wave-field';
import waterShaderSource from '../shaders/water.wgsl?raw';
import type { StreetTileCache } from '../street-tile-cache';
import { FOG_COLOR } from './fog';
import type { MapFrame } from './map-frame';
import type { RasterWaterMask } from './raster-water-mask';
import { SUN_DIRECTION } from './sun';

const FLOATS_PER_PLACEMENT = 4;
/** Water vertices: two `int16` in tenths of a metre, x east and z south — see `WaterMesh`. */
const WATER_VERTEX_BUFFERS: readonly GPUVertexBufferLayout[] = [
  {
    arrayStride: 2 * Int16Array.BYTES_PER_ELEMENT,
    attributes: [{ shaderLocation: 0, offset: 0, format: 'sint16x2' }],
  },
];

interface WaterDraw {
  readonly mesh: GpuMesh;
  readonly placementIndex: number;
}

/**
 * The water of every street tile in the picture: the water polygons drawn
 * flat on the ground over the raster tiles, with the shader computing a
 * moving wave surface per pixel and lighting it — sky reflection by Fresnel,
 * glints toward the sun — only where the raster shows open water, so its
 * bridges, piers and names stay on top. Drawn between the ground and the street, so the boxes and
 * cars stand over it; no depth, since nothing on the plane occludes it.
 */
export class MapWaterLayer implements RenderLayer {
  private readonly device: GPUDevice;
  private readonly pipeline: GPURenderPipeline;
  private readonly bindGroupLayout: GPUBindGroupLayout;
  private bindGroup: GPUBindGroup | undefined;
  private boundMaskView: GPUTextureView | undefined;
  private readonly uniformBuffer: GPUBuffer;
  private readonly uniformView: StructuredView;
  private readonly placementBuffer: GPUBuffer;
  private readonly placementData = new Float32Array(
    MAX_BUILDING_TILES_PER_FRAME * FLOATS_PER_PLACEMENT
  );
  private draws: readonly WaterDraw[] = [];

  constructor(
    context: GpuContext,
    private readonly cache: StreetTileCache,
    private readonly rasterWater: RasterWaterMask,
    /** The frame the ground layer produced this tick, or nothing when the picture is unchanged. */
    private readonly readFrame: () => MapFrame | undefined
  ) {
    this.device = context.device;
    const definitions = makeShaderDataDefinitions(waterShaderSource);
    this.uniformView = makeStructuredView(definitions.uniforms.U);
    this.uniformBuffer = this.device.createBuffer({
      size: this.uniformView.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.placementBuffer = this.device.createBuffer({
      size: this.placementData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });
    const shaderModule = this.device.createShaderModule({ code: waterShaderSource });
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] }),
      vertex: { module: shaderModule, entryPoint: 'vs', buffers: [...WATER_VERTEX_BUFFERS] },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [
          {
            format: context.format,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });
  }

  update(): void {
    const frame = this.readFrame();
    if (frame === undefined) {
      return;
    }
    this.draws = this.writePlacements(frame);
    if (this.draws.length === 0) {
      return;
    }
    const waves = waveFieldAround(frame.origin);
    this.uniformView.set({
      viewProjection: frame.viewProjection,
      cameraPosition: [frame.cameraPosition.x, frame.cameraPosition.y, frame.cameraPosition.z],
      fogStart: frame.fogStart,
      fogColor: [FOG_COLOR.r, FOG_COLOR.g, FOG_COLOR.b],
      fogEnd: frame.fogEnd,
      sunDirection: SUN_DIRECTION,
      time: frame.time,
      waveOffset: [waves.offset.x, waves.offset.y],
      riseSeconds: BUILDING_RISE_SECONDS,
      metresPerUnit: waves.metresPerUnit,
    });
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformView.arrayBuffer);
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView, state: FrameState): void {
    if (this.draws.length === 0) {
      return;
    }
    const maskView = this.rasterWater.ensureView(
      this.device,
      state.canvasWidth,
      state.canvasHeight
    );
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: canvasView, loadOp: 'load', storeOp: 'store' }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroupFor(maskView));
    for (const { mesh, placementIndex } of this.draws) {
      bindGpuMesh(pass, mesh);
      pass.drawIndexed(mesh.indexCount, 1, 0, 0, placementIndex);
    }
    pass.end();
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.placementBuffer.destroy();
  }

  /** The mask is a new texture after every resize; the bind group follows it. */
  private bindGroupFor(maskView: GPUTextureView): GPUBindGroup {
    if (this.bindGroup === undefined || this.boundMaskView !== maskView) {
      this.bindGroup = this.device.createBindGroup({
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer } },
          { binding: 1, resource: { buffer: this.placementBuffer } },
          { binding: 2, resource: maskView },
        ],
      });
      this.boundMaskView = maskView;
    }
    return this.bindGroup;
  }

  /** Only the tiles with water go in: the placement index is the draw's, not the frame's. */
  private writePlacements(frame: MapFrame): readonly WaterDraw[] {
    const draws: WaterDraw[] = [];
    for (const placement of frame.streetTiles) {
      const mesh = this.cache.waterOf(placement.key);
      if (mesh === undefined || draws.length === MAX_BUILDING_TILES_PER_FRAME) {
        continue;
      }
      const base = draws.length * FLOATS_PER_PLACEMENT;
      this.placementData[base] = placement.offsetX;
      this.placementData[base + 1] = placement.offsetZ;
      this.placementData[base + 2] = placement.scale;
      this.placementData[base + 3] = placement.riseStart;
      draws.push({ mesh, placementIndex: draws.length });
    }
    if (draws.length > 0) {
      this.device.queue.writeBuffer(
        this.placementBuffer,
        0,
        this.placementData,
        0,
        draws.length * FLOATS_PER_PLACEMENT
      );
    }
    return draws;
  }
}
