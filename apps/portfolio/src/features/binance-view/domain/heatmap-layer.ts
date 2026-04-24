import { assert } from '@frozik/utils/assert/assert';

import {
  CELL_ALPHA_LOW,
  FLOATS_PER_TEXEL,
  MSAA_SAMPLE_COUNT,
  SNAPSHOT_SLOTS,
  STRIPE_DARK_FACTOR,
  STRIPE_PERIOD_PX,
} from './constants';
import type { IBlockMeta, ITextureLayoutConfig } from './types';

export const HEATMAP_UNIFORMS_BYTES = 64;
export const BLOCK_DESCRIPTOR_BYTES = 16;

export interface IHeatmapLayerResources {
  readonly uniformsBuffer: GPUBuffer;
  readonly descriptorsBuffer: GPUBuffer;
}

export function createHeatmapResources(
  device: GPUDevice,
  maxBlocks: number
): IHeatmapLayerResources {
  const uniformsBuffer = device.createBuffer({
    size: HEATMAP_UNIFORMS_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: 'heatmap.uniforms',
  });

  const descriptorsBuffer = device.createBuffer({
    size: BLOCK_DESCRIPTOR_BYTES * Math.max(maxBlocks, 1),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    label: 'heatmap.descriptors',
  });

  return { uniformsBuffer, descriptorsBuffer };
}

export function createHeatmapBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'heatmap.bindGroupLayout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        texture: { sampleType: 'unfilterable-float', viewDimension: '2d' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });
}

export function createHeatmapBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  resources: IHeatmapLayerResources,
  dataTextureView: GPUTextureView
): GPUBindGroup {
  return device.createBindGroup({
    label: 'heatmap.bindGroup',
    layout,
    entries: [
      { binding: 0, resource: { buffer: resources.uniformsBuffer } },
      { binding: 1, resource: dataTextureView },
      { binding: 2, resource: { buffer: resources.descriptorsBuffer } },
    ],
  });
}

/**
 * Return the raw render-pipeline descriptor so the caller can build
 * the pipeline with either `createRenderPipeline` (sync, lazy WGSL
 * compile) or `createRenderPipelineAsync` (forces the compile during
 * creation and surfaces the exact failure reason via a rejected
 * promise). We prefer the async path in the renderer to get useful
 * errors out of Safari's Metal back-end, which otherwise delivers a
 * generic "Vertex library failed creation" on first draw.
 */
export function getHeatmapPipelineDescriptor(params: {
  device: GPUDevice;
  module: GPUShaderModule;
  layout: GPUBindGroupLayout;
  format: GPUTextureFormat;
  layoutConfig: ITextureLayoutConfig;
}): GPURenderPipelineDescriptor {
  const { device, module, layout, format, layoutConfig } = params;

  const alphaBlend: GPUBlendState = {
    color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  };

  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });

  return {
    label: 'heatmap.pipeline',
    layout: pipelineLayout,
    vertex: {
      module,
      entryPoint: 'vsHeatmap',
      constants: {
        SNAPSHOT_SLOTS,
        SNAPSHOTS_PER_ROW: layoutConfig.snapshotsPerRow,
        ROWS_PER_BLOCK: layoutConfig.rowsPerBlock,
      },
    },
    fragment: {
      module,
      entryPoint: 'fsHeatmap',
      constants: {
        STRIPE_PERIOD_PX,
        STRIPE_DARK_FACTOR,
        CELL_ALPHA_LOW,
      },
      targets: [{ format, blend: alphaBlend }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  };
}

export interface IHeatmapUniformValues {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly plotWidthPx: number;
  readonly viewTimeStartDeltaMs: number;
  readonly viewTimeEndDeltaMs: number;
  readonly timeStepMs: number;
  readonly priceStep: number;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly magnitudeMin: number;
  readonly magnitudeMax: number;
  readonly blockCount: number;
}

export function writeHeatmapUniforms(
  device: GPUDevice,
  buffer: GPUBuffer,
  values: IHeatmapUniformValues
): void {
  const data = new ArrayBuffer(HEATMAP_UNIFORMS_BYTES);
  const floats = new Float32Array(data);
  const uints = new Uint32Array(data);
  floats[0] = values.canvasWidth;
  floats[1] = values.canvasHeight;
  floats[2] = values.viewTimeStartDeltaMs;
  floats[3] = values.viewTimeEndDeltaMs;
  floats[4] = values.timeStepMs;
  floats[5] = values.priceStep;
  floats[6] = values.priceMin;
  floats[7] = values.priceMax;
  floats[8] = values.magnitudeMin;
  floats[9] = values.magnitudeMax;
  uints[10] = values.blockCount;
  floats[11] = values.plotWidthPx;
  // Remaining 4 × u32 slots stay zero (pad to 64 bytes).
  device.queue.writeBuffer(buffer, 0, data);
}

export interface IVisibleBlock {
  readonly meta: IBlockMeta;
  readonly textureRowIndex: number;
}

export interface IBlockDescriptorWriteResult {
  readonly totalCells: number;
  readonly totalInstances: number;
}

export function writeBlockDescriptors(
  device: GPUDevice,
  buffer: GPUBuffer,
  visibleBlocks: ReadonlyArray<IVisibleBlock>,
  globalBaseTimeMs: number
): IBlockDescriptorWriteResult {
  assert(
    visibleBlocks.length > 0 ? buffer.size >= BLOCK_DESCRIPTOR_BYTES * visibleBlocks.length : true,
    'descriptors buffer too small for visible blocks'
  );

  if (visibleBlocks.length === 0) {
    return { totalCells: 0, totalInstances: 0 };
  }

  const byteLength = BLOCK_DESCRIPTOR_BYTES * visibleBlocks.length;
  const data = new ArrayBuffer(byteLength);
  const uints = new Uint32Array(data);
  const floats = new Float32Array(data);

  let cumulativeOffset = 0;
  for (let index = 0; index < visibleBlocks.length; index++) {
    const block = visibleBlocks[index];
    const cellCount = block.meta.count * SNAPSHOT_SLOTS;
    const base = index * 4;
    uints[base + 0] = block.textureRowIndex;
    uints[base + 1] = block.meta.count;
    uints[base + 2] = cumulativeOffset;
    floats[base + 3] = block.meta.firstTimestampMs - globalBaseTimeMs;
    cumulativeOffset += cellCount;
  }

  device.queue.writeBuffer(buffer, 0, data);

  return { totalCells: cumulativeOffset, totalInstances: cumulativeOffset };
}

export const HEATMAP_VERTEX_COUNT_PER_INSTANCE = 6;

export function floatsPerBlockData(layoutConfig: ITextureLayoutConfig): number {
  return layoutConfig.textureWidth * layoutConfig.rowsPerBlock * FLOATS_PER_TEXEL;
}
