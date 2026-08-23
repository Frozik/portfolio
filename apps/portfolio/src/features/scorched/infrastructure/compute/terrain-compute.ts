import { COLLAPSE_GRAVITY_WU_PER_TICK_SQUARED } from '../../domain/constants';
import {
  CARVE_WORKGROUP_SIZE,
  COLLAPSE_WORKGROUP_SIZE,
  FLOATS_PER_CARVE_OP,
  MAX_CARVE_OPS_PER_DISPATCH,
  SCORCH_RING_WU,
  TERRAIN_TEXTURE_FORMAT,
} from '../render-constants';
import type { TerrainTextureSet } from '../terrain-texture';
import carveShaderSource from './carve.wgsl?raw';
import collapseShaderSource from './dirt-collapse.wgsl?raw';
import type { CarveOp } from './terrain-op-queue';
import { writeCarveOps } from './terrain-op-queue';

const PING_PONG_PARITIES = [0, 1] as const;
/** Both parameter blocks are one 16-byte struct: a scalar or two followed by padding. */
const PARAMS_BUFFER_BYTES = 16;
const OP_COUNT_OFFSET = 0;
const SCORCH_RING_OFFSET = 1;
const GRAVITY_OFFSET = 0;

export interface TerrainCompute {
  /** Stamps the queued explosions and hands the result to the next pass. */
  encodeCarve(encoder: GPUCommandEncoder, ops: readonly CarveOp[]): void;
  /** Advances the falling-sand animation by one 60 Hz step. */
  encodeCollapse(encoder: GPUCommandEncoder): void;
  /** Drops the per-column fall speeds; the field underneath them is about to be replaced. */
  resetColumnVelocities(): void;
  dispose(): void;
}

function createComputePipeline(
  device: GPUDevice,
  code: string,
  entryPoint: string,
  layout: GPUBindGroupLayout,
  constants: Record<string, number>
): GPUComputePipeline {
  return device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    compute: { module: device.createShaderModule({ code }), entryPoint, constants },
  });
}

function createPassBindGroupLayout(
  device: GPUDevice,
  storageBufferType: GPUBufferBindingType
): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float' } },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: 'write-only', format: TERRAIN_TEXTURE_FORMAT },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: storageBufferType },
      },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ],
  });
}

/**
 * The two compute passes that own the terrain texture between uploads (§11.1). Both read the
 * current texture and write the other one, then make that one current — so the render pass always
 * samples whatever came out of the last pass, and neither pass ever reads what it is writing.
 */
export function createTerrainCompute(
  device: GPUDevice,
  textures: TerrainTextureSet
): TerrainCompute {
  const carveLayout = createPassBindGroupLayout(device, 'read-only-storage');
  const collapseLayout = createPassBindGroupLayout(device, 'storage');

  const carvePipeline = createComputePipeline(
    device,
    carveShaderSource,
    'carveTerrain',
    carveLayout,
    { CARVE_WORKGROUP_SIZE }
  );
  const collapsePipeline = createComputePipeline(
    device,
    collapseShaderSource,
    'collapseDirt',
    collapseLayout,
    { COLLAPSE_WORKGROUP_SIZE }
  );

  const opFloats = new Float32Array(MAX_CARVE_OPS_PER_DISPATCH * FLOATS_PER_CARVE_OP);
  const opBuffer = device.createBuffer({
    size: opFloats.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const velocities = new Float32Array(textures.widthWu);
  const velocityBuffer = device.createBuffer({
    size: velocities.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const carveParams = new ArrayBuffer(PARAMS_BUFFER_BYTES);
  const carveParamCounts = new Uint32Array(carveParams);
  const carveParamValues = new Float32Array(carveParams);
  const carveParamsBuffer = device.createBuffer({
    size: PARAMS_BUFFER_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const collapseParams = new Float32Array(PARAMS_BUFFER_BYTES / Float32Array.BYTES_PER_ELEMENT);
  const collapseParamsBuffer = device.createBuffer({
    size: PARAMS_BUFFER_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  collapseParams[GRAVITY_OFFSET] = COLLAPSE_GRAVITY_WU_PER_TICK_SQUARED;
  device.queue.writeBuffer(collapseParamsBuffer, 0, collapseParams);

  function createBindGroups(
    layout: GPUBindGroupLayout,
    storageBuffer: GPUBuffer,
    paramsBuffer: GPUBuffer
  ): readonly GPUBindGroup[] {
    return PING_PONG_PARITIES.map(parity =>
      device.createBindGroup({
        layout,
        entries: [
          { binding: 0, resource: textures.getView(parity) },
          { binding: 1, resource: textures.getView(1 - parity) },
          { binding: 2, resource: { buffer: storageBuffer } },
          { binding: 3, resource: { buffer: paramsBuffer } },
        ],
      })
    );
  }

  const carveBindGroups = createBindGroups(carveLayout, opBuffer, carveParamsBuffer);
  const collapseBindGroups = createBindGroups(collapseLayout, velocityBuffer, collapseParamsBuffer);

  function encodePass(
    encoder: GPUCommandEncoder,
    pipeline: GPUComputePipeline,
    bindGroups: readonly GPUBindGroup[],
    workgroupsX: number,
    workgroupsY: number
  ): void {
    const pass = encoder.beginComputePass();

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroups[textures.currentIndex]);
    pass.dispatchWorkgroups(workgroupsX, workgroupsY);
    pass.end();

    textures.swap();
  }

  return {
    encodeCarve(encoder: GPUCommandEncoder, ops: readonly CarveOp[]): void {
      if (ops.length === 0) {
        return;
      }

      opFloats.fill(0);
      writeCarveOps(opFloats, ops);
      device.queue.writeBuffer(opBuffer, 0, opFloats);

      carveParamCounts[OP_COUNT_OFFSET] = ops.length;
      carveParamValues[SCORCH_RING_OFFSET] = SCORCH_RING_WU;
      device.queue.writeBuffer(carveParamsBuffer, 0, carveParams);

      encodePass(
        encoder,
        carvePipeline,
        carveBindGroups,
        Math.ceil(textures.widthWu / CARVE_WORKGROUP_SIZE),
        Math.ceil(textures.heightWu / CARVE_WORKGROUP_SIZE)
      );
    },

    encodeCollapse(encoder: GPUCommandEncoder): void {
      encodePass(
        encoder,
        collapsePipeline,
        collapseBindGroups,
        Math.ceil(textures.widthWu / COLLAPSE_WORKGROUP_SIZE),
        1
      );
    },

    resetColumnVelocities(): void {
      velocities.fill(0);
      device.queue.writeBuffer(velocityBuffer, 0, velocities);
    },

    dispose(): void {
      opBuffer.destroy();
      velocityBuffer.destroy();
      carveParamsBuffer.destroy();
      collapseParamsBuffer.destroy();
    },
  };
}
