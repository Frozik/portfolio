import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';
import type { Mat4 } from 'wgpu-matrix';

import {
  CHECKER_CELLS_PER_TILE,
  FADE_IN_SECONDS,
  MAX_ANISOTROPY,
  MAX_INSTANCES_PER_FRAME,
} from '../../domain/constants';
import type { WorldVector } from '../../domain/map-camera';
import groundShaderSource from '../shaders/ground.wgsl?raw';
import type { TileAtlas } from '../tile-atlas';
import { TILE_INSTANCE_BYTES } from '../tile-instance-buffer';

/** Pale haze the far ground dissolves into; also the clear colour, so the cut-off is invisible. */
const FOG_COLOR = { r: 0.84, g: 0.87, b: 0.9, a: 1 } as const;
const VERTICES_PER_QUAD = 6;

/** What the scene hands the layer for a frame that changed. */
export interface MapFrame {
  readonly viewProjection: Mat4;
  /** Camera position relative to the camera target, like the instance origins. */
  readonly cameraPosition: WorldVector;
  readonly fogStart: number;
  readonly fogEnd: number;
  readonly time: number;
  readonly instanceData: Float32Array;
  readonly instanceCount: number;
}

export class MapGroundLayer implements RenderLayer {
  private readonly device: GPUDevice;
  private readonly pipeline: GPURenderPipeline;
  private readonly bindGroupLayout: GPUBindGroupLayout;
  private readonly sampler: GPUSampler;
  private readonly uniformBuffer: GPUBuffer;
  private readonly uniformView: StructuredView;
  private readonly instanceBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup;
  private boundAtlasVersion: number;
  private instanceCount = 0;
  private dirty = true;

  constructor(
    context: GpuContext,
    private readonly atlas: TileAtlas,
    /** Returns the next frame to draw, or nothing when the picture is unchanged. */
    private readonly readFrame: (state: FrameState) => MapFrame | undefined
  ) {
    this.device = context.device;

    const definitions = makeShaderDataDefinitions(groundShaderSource);
    this.uniformView = makeStructuredView(definitions.uniforms.U);
    this.uniformBuffer = this.device.createBuffer({
      size: this.uniformView.arrayBuffer.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.instanceBuffer = this.device.createBuffer({
      size: MAX_INSTANCES_PER_FRAME * TILE_INSTANCE_BYTES,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      maxAnisotropy: MAX_ANISOTROPY,
    });

    const shaderModule = this.device.createShaderModule({ code: groundShaderSource });
    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'read-only-storage' },
        },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float', viewDimension: '2d-array' },
        },
      ],
    });
    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] }),
      vertex: { module: shaderModule, entryPoint: 'vs' },
      fragment: { module: shaderModule, entryPoint: 'fs', targets: [{ format: context.format }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });
    this.bindGroup = this.createBindGroup();
    this.boundAtlasVersion = atlas.version;
  }

  update(state: FrameState): void {
    const frame = this.readFrame(state);
    if (frame === undefined) {
      return;
    }
    this.uniformView.set({
      viewProjection: frame.viewProjection,
      cameraPosition: [frame.cameraPosition.x, frame.cameraPosition.y, frame.cameraPosition.z],
      time: frame.time,
      fogColor: [FOG_COLOR.r, FOG_COLOR.g, FOG_COLOR.b],
      fogStart: frame.fogStart,
      fogEnd: frame.fogEnd,
      fadeSeconds: FADE_IN_SECONDS,
      checkerCells: CHECKER_CELLS_PER_TILE,
    });
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformView.arrayBuffer);
    this.device.queue.writeBuffer(
      this.instanceBuffer,
      0,
      frame.instanceData,
      0,
      frame.instanceCount * (TILE_INSTANCE_BYTES / Float32Array.BYTES_PER_ELEMENT)
    );
    this.instanceCount = frame.instanceCount;
    this.dirty = true;
  }

  /** Render-on-demand gate: true once after every frame that changed something. */
  consumeDirty(): boolean {
    const wasDirty = this.dirty;
    this.dirty = false;
    return wasDirty;
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView): void {
    if (this.boundAtlasVersion !== this.atlas.version) {
      this.bindGroup = this.createBindGroup();
      this.boundAtlasVersion = this.atlas.version;
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        { view: canvasView, loadOp: 'clear', clearValue: FOG_COLOR, storeOp: 'store' },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(VERTICES_PER_QUAD, this.instanceCount);
    pass.end();
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.instanceBuffer.destroy();
  }

  private createBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.instanceBuffer } },
        { binding: 2, resource: this.sampler },
        { binding: 3, resource: this.atlas.createView() },
      ],
    });
  }
}
