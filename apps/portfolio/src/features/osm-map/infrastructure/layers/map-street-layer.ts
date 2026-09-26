import type { GpuContext } from '@frozik/utils/webgpu/createGpuContext';
import type { DepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';
import { createDepthTextureManager } from '@frozik/utils/webgpu/depthTextureManager';
import type { GpuMesh } from '@frozik/utils/webgpu/gpuMesh';
import { bindGpuMesh, releaseGpuMesh, uploadLitMesh } from '@frozik/utils/webgpu/gpuMesh';
import type { FrameState, RenderLayer } from '@frozik/utils/webgpu/renderLayer';
import type { StructuredView } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';

import type { CarBody } from '../../domain/car-bodies';
import { CAR_BODIES, CAR_COLORS, carBodyMesh } from '../../domain/car-bodies';
import {
  BUILDING_RISE_SECONDS,
  MAX_BUILDING_TILES_PER_FRAME,
  MAX_CARS_PER_FRAME,
} from '../../domain/constants';
import buildingsShaderSource from '../shaders/buildings.wgsl?raw';
import carsShaderSource from '../shaders/cars.wgsl?raw';
import type { StreetTileCache } from '../street-tile-cache';
import { FOG_COLOR } from './fog';
import type { MapFrame } from './map-frame';

const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';
const SINGLE_SAMPLE = 1;
const FLOATS_PER_PLACEMENT = 4;
const FLOATS_PER_CAR = 8;
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

/** The cars of one body this frame: a contiguous run of the car buffer, one instanced draw. */
interface CarDraw {
  readonly body: CarBody;
  readonly firstInstance: number;
  readonly count: number;
}

const LIT_MESH_VERTEX_BUFFERS: readonly GPUVertexBufferLayout[] = [
  {
    arrayStride: VERTEX_STRIDE_BYTES,
    attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
  },
  {
    arrayStride: VERTEX_STRIDE_BYTES,
    attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }],
  },
];
/** Building vertices: four `int16` in tenths of a metre, the fourth unused — see `BuildingMesh`. */
const BUILDING_VERTEX_BUFFERS: readonly GPUVertexBufferLayout[] = [
  {
    arrayStride: 4 * Int16Array.BYTES_PER_ELEMENT,
    attributes: [{ shaderLocation: 0, offset: 0, format: 'sint16x4' }],
  },
];

/**
 * The street over the raster ground: building boxes, one lit and fogged
 * draw per z14 tile, and the cars on its lanes, one instanced draw per body
 * shape. Every mesh stays in metres from its tile corner (a car from its own
 * centre) and never changes; a placement per tile — offset and metres-to-
 * units scale — puts it on the map. Drawn after the ground with its own
 * depth buffer, which the ground never writes: everything here stands above
 * the plane, so only the boxes and cars need to occlude each other.
 */
export class MapStreetLayer implements RenderLayer {
  private readonly device: GPUDevice;
  private readonly buildingPipeline: GPURenderPipeline;
  private readonly carPipeline: GPURenderPipeline;
  private readonly buildingBindGroup: GPUBindGroup;
  private readonly carBindGroup: GPUBindGroup;
  private readonly uniformBuffer: GPUBuffer;
  private readonly uniformView: StructuredView;
  private readonly placementBuffer: GPUBuffer;
  private readonly placementData = new Float32Array(
    MAX_BUILDING_TILES_PER_FRAME * FLOATS_PER_PLACEMENT
  );
  private readonly carBuffer: GPUBuffer;
  private readonly carData = new Float32Array(MAX_CARS_PER_FRAME * FLOATS_PER_CAR);
  private readonly carBodies: ReadonlyMap<CarBody, GpuMesh>;
  private readonly depth: DepthTextureManager;
  private buildingDraws: readonly BuildingDraw[] = [];
  private carDraws: readonly CarDraw[] = [];

  constructor(
    context: GpuContext,
    private readonly cache: StreetTileCache,
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
    this.carBuffer = this.device.createBuffer({
      size: this.carData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.carBodies = new Map(
      CAR_BODIES.flatMap(body => {
        const mesh = uploadLitMesh(this.device, carBodyMesh(body));
        return mesh === undefined ? [] : [[body, mesh] as const];
      })
    );

    const uniformEntry: GPUBindGroupLayoutEntry = {
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: 'uniform' },
    };
    const placementEntry: GPUBindGroupLayoutEntry = {
      binding: 1,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: 'read-only-storage' },
    };
    const buildingLayout = this.device.createBindGroupLayout({
      entries: [uniformEntry, placementEntry],
    });
    const carLayout = this.device.createBindGroupLayout({
      entries: [
        uniformEntry,
        placementEntry,
        { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });
    this.buildingPipeline = this.createPipeline(
      context.format,
      buildingLayout,
      buildingsShaderSource,
      BUILDING_VERTEX_BUFFERS
    );
    this.carPipeline = this.createPipeline(
      context.format,
      carLayout,
      carsShaderSource,
      LIT_MESH_VERTEX_BUFFERS
    );
    this.buildingBindGroup = this.device.createBindGroup({
      layout: buildingLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.placementBuffer } },
      ],
    });
    this.carBindGroup = this.device.createBindGroup({
      layout: carLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.placementBuffer } },
        { binding: 2, resource: { buffer: this.carBuffer } },
      ],
    });
  }

  update(): void {
    const frame = this.readFrame();
    if (frame === undefined) {
      return;
    }
    this.buildingDraws = this.writePlacements(frame);
    this.carDraws = this.writeCars(frame);
    if (this.buildingDraws.length === 0 && this.carDraws.length === 0) {
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
    if (this.buildingDraws.length === 0 && this.carDraws.length === 0) {
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
    pass.setPipeline(this.buildingPipeline);
    pass.setBindGroup(0, this.buildingBindGroup);
    for (const { mesh, placementIndex } of this.buildingDraws) {
      bindGpuMesh(pass, mesh);
      pass.drawIndexed(mesh.indexCount, 1, 0, 0, placementIndex);
    }
    if (this.carDraws.length > 0) {
      pass.setPipeline(this.carPipeline);
      pass.setBindGroup(0, this.carBindGroup);
      for (const { body, firstInstance, count } of this.carDraws) {
        const mesh = this.carBodies.get(body);
        if (mesh !== undefined) {
          bindGpuMesh(pass, mesh);
          pass.drawIndexed(mesh.indexCount, count, 0, 0, firstInstance);
        }
      }
    }
    pass.end();
  }

  dispose(): void {
    this.uniformBuffer.destroy();
    this.placementBuffer.destroy();
    this.carBuffer.destroy();
    for (const mesh of this.carBodies.values()) {
      releaseGpuMesh(mesh);
    }
    this.depth.dispose();
  }

  /** Every placement goes in, indexed as the frame lists them, so the cars can refer to tiles without a mesh. */
  private writePlacements(frame: MapFrame): readonly BuildingDraw[] {
    const draws: BuildingDraw[] = [];
    const count = Math.min(frame.streetTiles.length, MAX_BUILDING_TILES_PER_FRAME);
    for (let index = 0; index < count; index++) {
      const placement = frame.streetTiles[index];
      const base = index * FLOATS_PER_PLACEMENT;
      this.placementData[base] = placement.offsetX;
      this.placementData[base + 1] = placement.offsetZ;
      this.placementData[base + 2] = placement.scale;
      this.placementData[base + 3] = placement.riseStart;
      const mesh = this.cache.buildingsOf(placement.key);
      if (mesh !== undefined) {
        draws.push({ mesh, placementIndex: index });
      }
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
    return draws;
  }

  /** Cars sorted by body so each body is one contiguous instanced draw. */
  private writeCars(frame: MapFrame): readonly CarDraw[] {
    const placed = frame.cars
      .filter(car => car.placementIndex < MAX_BUILDING_TILES_PER_FRAME)
      .slice(0, MAX_CARS_PER_FRAME);
    const draws: CarDraw[] = [];
    let written = 0;
    for (const body of CAR_BODIES) {
      const firstInstance = written;
      for (const car of placed) {
        if (car.body !== body) {
          continue;
        }
        const base = written * FLOATS_PER_CAR;
        const [red, green, blue] = CAR_COLORS[car.colorIndex] ?? CAR_COLORS[0];
        this.carData[base] = car.x;
        this.carData[base + 1] = car.y;
        this.carData[base + 2] = car.headingRad;
        this.carData[base + 3] = car.placementIndex;
        this.carData[base + 4] = red;
        this.carData[base + 5] = green;
        this.carData[base + 6] = blue;
        written++;
      }
      if (written > firstInstance) {
        draws.push({ body, firstInstance, count: written - firstInstance });
      }
    }
    if (written > 0) {
      this.device.queue.writeBuffer(this.carBuffer, 0, this.carData, 0, written * FLOATS_PER_CAR);
    }
    return draws;
  }

  private createPipeline(
    format: GPUTextureFormat,
    bindGroupLayout: GPUBindGroupLayout,
    shaderSource: string,
    vertexBuffers: readonly GPUVertexBufferLayout[]
  ): GPURenderPipeline {
    const shaderModule = this.device.createShaderModule({ code: shaderSource });
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module: shaderModule, entryPoint: 'vs', buffers: [...vertexBuffers] },
      fragment: { module: shaderModule, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: 'less' },
    });
  }
}
