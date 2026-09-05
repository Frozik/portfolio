import { assert } from '@frozik/utils/assert/assert';

import { hexToLinearRgb } from '../../domain/color-utils';
import { MSAA_SAMPLE_COUNT } from '../../domain/constants';
import { COLOR_BUY, COLOR_SELL, VOLUME_BAR_HOVER_MIX } from '../../domain/trades-constants';

const TRADES_UNIFORMS_BYTES = 64;
const VOLUME_BAR_DESCRIPTOR_BYTES = 16;
const VOLUME_BAR_DESCRIPTOR_FLOATS = VOLUME_BAR_DESCRIPTOR_BYTES / 4;
/** Two stacked rectangles (buy, sell) per bucket. */
export const VOLUME_BAR_VERTEX_COUNT_PER_INSTANCE = 12;

/** Resources held across the trades pipeline's lifetime. */
export interface ITradesLayerResources {
  readonly uniformsBuffer: GPUBuffer;
  readonly volumeBarsBuffer: GPUBuffer;
}

export function createTradesResources(
  device: GPUDevice,
  maxBuckets: number
): ITradesLayerResources {
  return {
    uniformsBuffer: device.createBuffer({
      size: TRADES_UNIFORMS_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: 'trades.uniforms',
    }),
    volumeBarsBuffer: device.createBuffer({
      size: VOLUME_BAR_DESCRIPTOR_BYTES * Math.max(maxBuckets, 1),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      label: 'trades.volumeBars',
    }),
  };
}

export function createTradesBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'trades.bindGroupLayout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
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
      { binding: 1, resource: { buffer: resources.volumeBarsBuffer } },
    ],
  });
}

/**
 * Colour overrides are linearised at pipeline creation via `hexToLinearRgb`
 * so the shader receives linear-sRGB floats and never calls `pow()` per
 * fragment. Overrides go only to the stage that references them:
 * Safari/Metal rejects a vertex stage handed constants it does not use.
 */
export function getVolumeBarsPipelineDescriptor(params: {
  device: GPUDevice;
  module: GPUShaderModule;
  layout: GPUBindGroupLayout;
  format: GPUTextureFormat;
}): GPURenderPipelineDescriptor {
  const { device, module, layout, format } = params;
  const buyLinear = hexToLinearRgb(COLOR_BUY);
  const sellLinear = hexToLinearRgb(COLOR_SELL);
  return {
    label: 'trades.volumeBars.pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
    vertex: { module, entryPoint: 'vsVolumeBar' },
    fragment: {
      module,
      entryPoint: 'fsVolumeBar',
      constants: {
        HOVER_MIX: VOLUME_BAR_HOVER_MIX,
        COLOR_BUY_R: buyLinear.r,
        COLOR_BUY_G: buyLinear.g,
        COLOR_BUY_B: buyLinear.b,
        COLOR_SELL_R: sellLinear.r,
        COLOR_SELL_G: sellLinear.g,
        COLOR_SELL_B: sellLinear.b,
      },
      targets: [{ format }],
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
  readonly panelTopPx: number;
  readonly panelHeightPx: number;
  readonly barWidthPx: number;
}

/** Packs the 64-byte uniform block; the tail stays zero to match the WGSL `TradesUniforms` struct. */
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
  floats[5] = values.panelTopPx;
  floats[6] = values.panelHeightPx;
  floats[7] = values.barWidthPx;
  device.queue.writeBuffer(buffer, 0, data);
}

export interface IVolumeBar {
  /** Bucket centre relative to the view start anchor, ms. */
  readonly centerTimeDeltaMs: number;
  /** Bucket volume over the heaviest visible bucket, in `[0, 1]`. */
  readonly volumeFraction: number;
  readonly buyFraction: number;
  readonly isHovered: boolean;
}

export function writeVolumeBarDescriptors(
  device: GPUDevice,
  buffer: GPUBuffer,
  bars: ReadonlyArray<IVolumeBar>
): number {
  assert(
    buffer.size >= VOLUME_BAR_DESCRIPTOR_BYTES * bars.length,
    'trades: volume bars buffer too small for visible buckets'
  );
  if (bars.length === 0) {
    return 0;
  }
  const floats = new Float32Array(bars.length * VOLUME_BAR_DESCRIPTOR_FLOATS);
  bars.forEach((bar, index) => {
    const base = index * VOLUME_BAR_DESCRIPTOR_FLOATS;
    floats[base] = bar.centerTimeDeltaMs;
    floats[base + 1] = bar.volumeFraction;
    floats[base + 2] = bar.buyFraction;
    floats[base + 3] = bar.isHovered ? 1 : 0;
  });
  device.queue.writeBuffer(buffer, 0, floats);
  return bars.length;
}
