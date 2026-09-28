import type { GpuMesh } from '@frozik/utils/webgpu/gpuMesh';
import { bindGpuMesh, releaseGpuMesh, uploadLitMesh } from '@frozik/utils/webgpu/gpuMesh';

import type { CarBody } from '../../domain/car-bodies';
import { CAR_BODIES, CAR_COLORS, carBodyMesh } from '../../domain/car-bodies';
import { MAX_BUILDING_TILES_PER_FRAME, MAX_CARS_PER_FRAME } from '../../domain/constants';
import carsShaderSource from '../shaders/cars.wgsl?raw';
import type { MapFrame } from './map-frame';
import type { StreetPainter, StreetPassResources } from './street-painter';
import { createStreetPipeline, PLACEMENTS_BINDING, UNIFORM_BINDING } from './street-painter';

const FLOATS_PER_CAR = 8;
const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
const VERTEX_STRIDE_BYTES = 3 * FLOAT_BYTES;

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

/** The cars of one body this frame: a contiguous run of the car buffer, one instanced draw. */
interface CarDraw {
  readonly body: CarBody;
  readonly firstInstance: number;
  readonly count: number;
}

/** The cars on the lanes: one instanced draw per body shape, each car placed by its tile's placement. */
export class CarPainter implements StreetPainter {
  private readonly device: GPUDevice;
  private readonly pipeline: GPURenderPipeline;
  private readonly bindGroup: GPUBindGroup;
  private readonly carBuffer: GPUBuffer;
  private readonly carData = new Float32Array(MAX_CARS_PER_FRAME * FLOATS_PER_CAR);
  private readonly bodies: ReadonlyMap<CarBody, GpuMesh>;
  private draws: readonly CarDraw[] = [];

  constructor(resources: StreetPassResources) {
    this.device = resources.device;
    this.carBuffer = this.device.createBuffer({
      size: this.carData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.bodies = new Map(
      CAR_BODIES.flatMap(body => {
        const mesh = uploadLitMesh(this.device, carBodyMesh(body));
        return mesh === undefined ? [] : [[body, mesh] as const];
      })
    );
    const layout = this.device.createBindGroupLayout({
      entries: [
        UNIFORM_BINDING,
        PLACEMENTS_BINDING,
        { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });
    this.pipeline = createStreetPipeline(
      resources,
      layout,
      carsShaderSource,
      LIT_MESH_VERTEX_BUFFERS
    );
    this.bindGroup = this.device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: resources.uniformBuffer } },
        { binding: 1, resource: { buffer: resources.placementBuffer } },
        { binding: 2, resource: { buffer: this.carBuffer } },
      ],
    });
  }

  /** Cars sorted by body so each body is one contiguous instanced draw. */
  update(frame: MapFrame): boolean {
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
    this.draws = draws;
    return draws.length > 0;
  }

  draw(pass: GPURenderPassEncoder): void {
    if (this.draws.length === 0) {
      return;
    }
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    for (const { body, firstInstance, count } of this.draws) {
      const mesh = this.bodies.get(body);
      if (mesh !== undefined) {
        bindGpuMesh(pass, mesh);
        pass.drawIndexed(mesh.indexCount, count, 0, 0, firstInstance);
      }
    }
  }

  dispose(): void {
    this.carBuffer.destroy();
    for (const mesh of this.bodies.values()) {
      releaseGpuMesh(mesh);
    }
  }
}
