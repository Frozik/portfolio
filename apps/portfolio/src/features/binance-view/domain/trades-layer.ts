import { assert } from '@frozik/utils/assert/assert';

import { hexToLinearRgb } from './color-utils';
import { MSAA_SAMPLE_COUNT } from './constants';
import { AA_WIDTH_PX, COLOR_BUY, COLOR_OUTLINE, COLOR_SELL, OUTLINE_PX } from './trades-constants';

export const TRADES_UNIFORMS_BYTES = 64;
/**
 * Bytes per per-bucket descriptor entry in the storage buffer. 32 bytes
 * (8 × f32) — the active payload uses 5 floats (centerTimeDeltaMs,
 * centerPriceDelta, radiusPx, buyFraction, fillOpacity); the remaining
 * 3 are padding to keep the struct on a 16-byte boundary, matching
 * the WGSL `TradeBucketDescriptor` layout in `trades-common.wgsl`.
 */
export const TRADES_BUCKET_DESCRIPTOR_BYTES = 32;
const TRADES_BUCKET_DESCRIPTOR_FLOATS = TRADES_BUCKET_DESCRIPTOR_BYTES / 4;
export const TRADES_VERTEX_COUNT_PER_INSTANCE = 6;

/** Resources held across the trades pipeline's lifetime. */
export interface ITradesLayerResources {
  readonly uniformsBuffer: GPUBuffer;
  readonly descriptorsBuffer: GPUBuffer;
}

export function createTradesResources(
  device: GPUDevice,
  maxBuckets: number
): ITradesLayerResources {
  const uniformsBuffer = device.createBuffer({
    size: TRADES_UNIFORMS_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: 'trades.uniforms',
  });

  const descriptorsBuffer = device.createBuffer({
    size: TRADES_BUCKET_DESCRIPTOR_BYTES * Math.max(maxBuckets, 1),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    label: 'trades.descriptors',
  });

  return { uniformsBuffer, descriptorsBuffer };
}

export function createTradesBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'trades.bindGroupLayout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });
}

export function createTradesBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  resources: ITradesLayerResources
): GPUBindGroup {
  return device.createBindGroup({
    label: 'trades.bindGroup',
    layout,
    entries: [
      { binding: 0, resource: { buffer: resources.uniformsBuffer } },
      { binding: 1, resource: { buffer: resources.descriptorsBuffer } },
    ],
  });
}

/**
 * Return the raw render-pipeline descriptor so the caller can build
 * the pipeline with either `createRenderPipeline` (sync, lazy WGSL
 * compile) or `createRenderPipelineAsync` (forces the compile during
 * creation and surfaces the exact failure reason via a rejected
 * promise) — same trade-off as the heatmap / mid-price layers.
 *
 * Colour overrides are linearised at pipeline-creation via
 * `hexToLinearRgb` so the shader receives WebGPU-native linear-sRGB
 * floats and never has to call `pow()` per fragment.
 */
export function getTradesPipelineDescriptor(params: {
  device: GPUDevice;
  module: GPUShaderModule;
  layout: GPUBindGroupLayout;
  format: GPUTextureFormat;
}): GPURenderPipelineDescriptor {
  const { device, module, layout, format } = params;

  // Premultiplied alpha — matches the mid-price interior pass so the
  // trades bubbles compose cleanly over both the heatmap and the line.
  const alphaBlend: GPUBlendState = {
    color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  };

  const buyLinear = hexToLinearRgb(COLOR_BUY);
  const sellLinear = hexToLinearRgb(COLOR_SELL);
  const outlineLinear = hexToLinearRgb(COLOR_OUTLINE);

  // Pass overrides only to the stage that actually references them.
  // Safari/Metal rejects the vertex pipeline ("Vertex library failed
  // creation") when it sees pipeline-override constants that aren't
  // used by `vsTrade` — particularly the `COLOR_*` overrides which
  // are declared without default values. `vsTrade` uses none of these;
  // every reference lives in `fsTrade`.
  const fragmentConstants = {
    OUTLINE_PX,
    AA_WIDTH_PX,
    COLOR_BUY_R: buyLinear.r,
    COLOR_BUY_G: buyLinear.g,
    COLOR_BUY_B: buyLinear.b,
    COLOR_SELL_R: sellLinear.r,
    COLOR_SELL_G: sellLinear.g,
    COLOR_SELL_B: sellLinear.b,
    COLOR_OUTLINE_R: outlineLinear.r,
    COLOR_OUTLINE_G: outlineLinear.g,
    COLOR_OUTLINE_B: outlineLinear.b,
  };

  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });

  return {
    label: 'trades.pipeline',
    layout: pipelineLayout,
    vertex: {
      module,
      entryPoint: 'vsTrade',
    },
    fragment: {
      module,
      entryPoint: 'fsTrade',
      constants: fragmentConstants,
      targets: [{ format, blend: alphaBlend }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  };
}

export interface ITradesUniformValues {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly plotWidthPx: number;
  readonly viewTimeStartDeltaMs: number;
  readonly viewTimeEndDeltaMs: number;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly devicePixelRatio: number;
}

/**
 * Pack 8 f32s into the 64-byte uniform block. The remaining 32 bytes
 * are reserved padding (zeroed by `ArrayBuffer` initialisation) so the
 * layout matches the WGSL `TradesUniforms` struct exactly.
 */
export function writeTradesUniforms(
  device: GPUDevice,
  buffer: GPUBuffer,
  values: ITradesUniformValues
): void {
  const data = new ArrayBuffer(TRADES_UNIFORMS_BYTES);
  const floats = new Float32Array(data);

  floats[0] = values.canvasWidth;
  floats[1] = values.canvasHeight;
  floats[2] = values.plotWidthPx;
  floats[3] = values.viewTimeStartDeltaMs;
  floats[4] = values.viewTimeEndDeltaMs;
  floats[5] = values.priceMin;
  floats[6] = values.priceMax;
  floats[7] = values.devicePixelRatio;
  // indices 8..15 stay zero (pad to 64 bytes).

  device.queue.writeBuffer(buffer, 0, data);
}

export interface ITradesVisibleBucket {
  /** Bucket center time (ms) — already a delta from the viewTimeStart anchor. */
  readonly centerTimeDeltaMs: number;
  /** Bucket center price — delta from priceMin anchor. */
  readonly centerPriceDelta: number;
  readonly radiusPx: number;
  readonly buyFraction: number;
  /**
   * Size-driven fill alpha multiplier in `[0, 1]`. Computed CPU-side from
   * the BASE radius (pre-hover) so hovering doesn't change the
   * transparency — bigger circles fade so the heatmap stays readable.
   */
  readonly fillOpacity: number;
}

export interface ITradesBucketWriteResult {
  readonly totalBuckets: number;
}

/**
 * Pack each visible bucket as 8 f32s (32 bytes) into the storage
 * buffer — 5 active fields (centerTimeDeltaMs, centerPriceDelta,
 * radiusPx, buyFraction, fillOpacity) plus 3 floats of padding to
 * align the entry on a 16-byte boundary (matches the WGSL
 * `TradeBucketDescriptor` layout). The shader uses `instance_index`
 * to pick a descriptor per draw, so the order of `buckets` must
 * match the draw call's `firstInstance` / `instanceCount` parameters.
 */
export function writeTradesBucketDescriptors(
  device: GPUDevice,
  buffer: GPUBuffer,
  buckets: ReadonlyArray<ITradesVisibleBucket>
): ITradesBucketWriteResult {
  assert(
    buckets.length > 0 ? buffer.size >= TRADES_BUCKET_DESCRIPTOR_BYTES * buckets.length : true,
    'trades: descriptors buffer too small for visible buckets'
  );

  if (buckets.length === 0) {
    return { totalBuckets: 0 };
  }

  const byteLength = TRADES_BUCKET_DESCRIPTOR_BYTES * buckets.length;
  const data = new ArrayBuffer(byteLength);
  const floats = new Float32Array(data);

  for (let index = 0; index < buckets.length; index++) {
    const bucket = buckets[index];
    const base = index * TRADES_BUCKET_DESCRIPTOR_FLOATS;
    floats[base + 0] = bucket.centerTimeDeltaMs;
    floats[base + 1] = bucket.centerPriceDelta;
    floats[base + 2] = bucket.radiusPx;
    floats[base + 3] = bucket.buyFraction;
    floats[base + 4] = bucket.fillOpacity;
    // floats[base + 5..7] stay zero — padding to the next 16-byte boundary.
  }

  device.queue.writeBuffer(buffer, 0, data);
  return { totalBuckets: buckets.length };
}
