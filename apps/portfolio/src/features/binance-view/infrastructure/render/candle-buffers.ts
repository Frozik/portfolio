import { assert } from '@frozik/utils/assert/assert';

import type { ICandleBlockIndexItem } from '../../domain/candle-types';
import { hexToLinearRgb } from '../../domain/color-utils';
import {
  CANDLE_COLOR_DOWN,
  CANDLE_COLOR_OUTLINE,
  CANDLE_COLOR_UP,
  CANDLE_TEXTURE_WIDTH,
  MOVING_AVERAGE_LONG_COLOR,
  MOVING_AVERAGE_SHORT_COLOR,
  MSAA_SAMPLE_COUNT,
} from '../../domain/constants';

export const CANDLE_UNIFORMS_BYTES = 64;
export const CANDLE_BLOCK_DESCRIPTOR_BYTES = 16;
export const CANDLE_VERTEX_COUNT_PER_INSTANCE = 6;

export interface ICandleLayerResources {
  readonly uniformsBuffer: GPUBuffer;
  readonly descriptorsBuffer: GPUBuffer;
}

export function createCandleResources(device: GPUDevice, maxBlocks: number): ICandleLayerResources {
  return {
    uniformsBuffer: device.createBuffer({
      size: CANDLE_UNIFORMS_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'candles.uniforms',
    }),
    descriptorsBuffer: device.createBuffer({
      size: CANDLE_BLOCK_DESCRIPTOR_BYTES * Math.max(maxBlocks, 1),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: 'candles.descriptors',
    }),
  };
}

export function createCandleBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'candles.bindGroupLayout',
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
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
    ],
  });
}

export function createCandleBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  resources: ICandleLayerResources,
  dataTextureView: GPUTextureView
): GPUBindGroup {
  return device.createBindGroup({
    label: 'candles.bindGroup',
    layout,
    entries: [
      { binding: 0, resource: { buffer: resources.uniformsBuffer } },
      { binding: 1, resource: dataTextureView },
      { binding: 2, resource: { buffer: resources.descriptorsBuffer } },
    ],
  });
}

interface IPipelineParams {
  readonly device: GPUDevice;
  readonly module: GPUShaderModule;
  readonly layout: GPUBindGroupLayout;
  readonly format: GPUTextureFormat;
}

const OPAQUE_TARGET_BLEND: GPUBlendState = {
  color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
};

function colorConstants(prefix: string, hex: string): Record<string, number> {
  const { r, g, b } = hexToLinearRgb(hex);
  return { [`${prefix}_R`]: r, [`${prefix}_G`]: g, [`${prefix}_B`]: b };
}

export function getCandlePipelineDescriptor(params: IPipelineParams): GPURenderPipelineDescriptor {
  const { device, module, layout, format } = params;
  return {
    label: 'candles.pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    vertex: { module, entryPoint: 'vsCandle' },
    fragment: {
      module,
      entryPoint: 'fsCandle',
      constants: {
        ...colorConstants('COLOR_UP', CANDLE_COLOR_UP),
        ...colorConstants('COLOR_DOWN', CANDLE_COLOR_DOWN),
        ...colorConstants('COLOR_OUTLINE', CANDLE_COLOR_OUTLINE),
      },
      targets: [{ format, blend: OPAQUE_TARGET_BLEND }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  };
}

export type MovingAverageKind = 'short' | 'long';

const MOVING_AVERAGE_CHANNEL: Record<MovingAverageKind, number> = { short: 0, long: 1 };
const MOVING_AVERAGE_COLOR: Record<MovingAverageKind, string> = {
  short: MOVING_AVERAGE_SHORT_COLOR,
  long: MOVING_AVERAGE_LONG_COLOR,
};

export function getMovingAveragePipelineDescriptor(
  params: IPipelineParams,
  kind: MovingAverageKind
): GPURenderPipelineDescriptor {
  const { device, module, layout, format } = params;
  return {
    label: `candles.movingAverage.${kind}.pipeline`,
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    vertex: {
      module,
      entryPoint: 'vsMovingAverage',
      constants: { MA_CHANNEL: MOVING_AVERAGE_CHANNEL[kind] },
    },
    fragment: {
      module,
      entryPoint: 'fsMovingAverage',
      constants: colorConstants('MA_COLOR', MOVING_AVERAGE_COLOR[kind]),
      targets: [{ format, blend: OPAQUE_TARGET_BLEND }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  };
}

export interface ICandleUniformValues {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly plotWidthPx: number;
  readonly viewTimeStartDeltaMs: number;
  readonly viewTimeEndDeltaMs: number;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly candleWidthPx: number;
  readonly wickWidthPx: number;
  readonly minBodyHeightPx: number;
  readonly lineWidthPx: number;
  readonly blockCount: number;
  readonly plotHeightPx: number;
}

export function writeCandleUniforms(
  device: GPUDevice,
  buffer: GPUBuffer,
  values: ICandleUniformValues
): void {
  const data = new ArrayBuffer(CANDLE_UNIFORMS_BYTES);
  const floats = new Float32Array(data);
  const uints = new Uint32Array(data);
  floats[0] = values.canvasWidth;
  floats[1] = values.canvasHeight;
  floats[2] = values.plotWidthPx;
  floats[3] = values.viewTimeStartDeltaMs;
  floats[4] = values.viewTimeEndDeltaMs;
  floats[5] = values.priceMin;
  floats[6] = values.priceMax;
  floats[7] = values.candleWidthPx;
  floats[8] = values.wickWidthPx;
  floats[9] = values.minBodyHeightPx;
  floats[10] = values.lineWidthPx;
  uints[11] = values.blockCount;
  uints[12] = CANDLE_TEXTURE_WIDTH;
  floats[13] = values.plotHeightPx;
  device.queue.writeBuffer(buffer, 0, data);
}

export interface ICandleVisibleBlock {
  readonly item: ICandleBlockIndexItem;
  readonly textureOffset: number;
}

/** Packs block descriptors in time order; returns the total candle count across them. */
export function writeCandleBlockDescriptors(
  device: GPUDevice,
  buffer: GPUBuffer,
  visibleBlocks: ReadonlyArray<ICandleVisibleBlock>,
  globalBaseTimeMs: number
): number {
  assert(
    buffer.size >= CANDLE_BLOCK_DESCRIPTOR_BYTES * visibleBlocks.length,
    'candles: descriptors buffer too small for visible blocks'
  );
  if (visibleBlocks.length === 0) {
    return 0;
  }
  const data = new ArrayBuffer(CANDLE_BLOCK_DESCRIPTOR_BYTES * visibleBlocks.length);
  const uints = new Uint32Array(data);
  const floats = new Float32Array(data);
  let totalCandles = 0;
  visibleBlocks.forEach((visible, index) => {
    const base = index * 4;
    uints[base] = visible.textureOffset;
    uints[base + 1] = visible.item.count;
    floats[base + 2] = visible.item.firstBucketStartMs - globalBaseTimeMs;
    floats[base + 3] = visible.item.basePrice;
    totalCandles += visible.item.count;
  });
  device.queue.writeBuffer(buffer, 0, data);
  return totalCandles;
}
