import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { DepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';
import { createDepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';

import { BUILDING_RISE_SECONDS, MAX_BUILDING_TILES_PER_FRAME } from '../../domain/constants';
import buildingsShaderSource from '../shaders/buildings.wgsl?raw';
import type { StreetTileCache } from '../street-tile-cache';
import { BuildingPainter } from './building-painter';
import { CarPainter } from './car-painter';
import { FOG_COLOR } from './fog';
import type { MapFrame } from './map-frame';
import type { StreetPainter } from './street-painter';
import { TreePainter } from './tree-painter';

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';
const SINGLE_SAMPLE = 1;
const FLOATS_PER_PLACEMENT = 4;
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

/**
 * The street over the raster ground: building boxes, trees and the cars on
 * the lanes, each drawn by its painter into one pass with its own depth
 * buffer, which the ground never writes — everything here stands above the
 * plane, so only these need to occlude each other. Every mesh stays in
 * metres from its tile corner and never changes; a placement per tile —
 * offset and metres-to-units scale — puts it on the map, and the layer owns
 * the placements and the uniforms every painter reads.
 */
export class MapStreetLayer implements RenderLayer {
  private readonly device: GPUDevice;
  private readonly uniformBuffer: GPUBuffer;
  private readonly uniformView: StructuredView;
  private readonly placementBuffer: GPUBuffer;
  private readonly placementData = new Float32Array(
    MAX_BUILDING_TILES_PER_FRAME * FLOATS_PER_PLACEMENT
  );
  private readonly painters: readonly StreetPainter[];
  private readonly depth: DepthTextureManager;
  private hasDraws = false;

  constructor(
    context: GpuContext,
    cache: StreetTileCache,
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
    const resources = {
      device: this.device,
      format: context.format,
      depthFormat: DEPTH_FORMAT,
      uniformBuffer: this.uniformBuffer,
      placementBuffer: this.placementBuffer,
    };
    this.painters = [
      new BuildingPainter(resources, cache),
      new TreePainter(resources, cache),
      new CarPainter(resources),
    ];
  }

  update(): void {
    const frame = this.readFrame();
    if (frame === undefined) {
      return;
    }
    this.writePlacements(frame);
    this.hasDraws = this.painters.map(painter => painter.update(frame)).includes(true);
    if (!this.hasDraws) {
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
  }

  render(encoder: GPUCommandEncoder, canvasView: GPUTextureView, state: FrameState): void {
    if (!this.hasDraws) {
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
    for (const painter of this.painters) {
      painter.draw(pass);
    }
    pass.end();
  }

  dispose(): void {
    for (const painter of this.painters) {
      painter.dispose();
    }
    this.uniformBuffer.destroy();
    this.placementBuffer.destroy();
    this.depth.dispose();
  }

  /** Every placement goes in, indexed as the frame lists them, so the cars can refer to tiles without a mesh. */
  private writePlacements(frame: MapFrame): void {
    const count = Math.min(frame.streetTiles.length, MAX_BUILDING_TILES_PER_FRAME);
    for (let index = 0; index < count; index++) {
      const placement = frame.streetTiles[index];
      const base = index * FLOATS_PER_PLACEMENT;
      this.placementData[base] = placement.offsetX;
      this.placementData[base + 1] = placement.offsetZ;
      this.placementData[base + 2] = placement.scale;
      this.placementData[base + 3] = placement.riseStart;
    }
    if (count > 0) {
      this.device.queue.writeBuffer(
        this.placementBuffer,
        0,
        this.placementData,
        0,
        count * FLOATS_PER_PLACEMENT
      );
    }
  }
}
