import { assert } from '@frozik/utils/assert/assert';
import {
  MID_PRICE_MAX_WIDTH_PX,
  MID_PRICE_MIN_WIDTH_PX,
  MID_PRICE_OUTLINE_WIDTH_PX,
  MID_PRICE_TEXTURE_WIDTH,
  MID_PRICE_VERTICES_PER_INSTANCE,
  MID_PRICE_WIDTH_SCALE,
  MSAA_SAMPLE_COUNT,
} from './constants';
import type { IMidPriceBlockIndexItem } from './mid-price-types';

export const MID_PRICE_UNIFORMS_BYTES = 64;
export const MID_PRICE_BLOCK_DESCRIPTOR_BYTES = 16;

/** Resources held across the mid-price pipeline's lifetime. */
export interface IMidPriceLayerResources {
  readonly uniformsBuffer: GPUBuffer;
  readonly descriptorsBuffer: GPUBuffer;
}

export function createMidPriceResources(
  device: GPUDevice,
  maxBlocks: number
): IMidPriceLayerResources {
  const uniformsBuffer = device.createBuffer({
    size: MID_PRICE_UNIFORMS_BYTES,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: 'mid-price.uniforms',
  });

  const descriptorsBuffer = device.createBuffer({
    size: MID_PRICE_BLOCK_DESCRIPTOR_BYTES * Math.max(maxBlocks, 1),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    label: 'mid-price.descriptors',
  });

  return { uniformsBuffer, descriptorsBuffer };
}

export function createMidPriceBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'mid-price.bindGroupLayout',
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

export function createMidPriceBindGroup(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  resources: IMidPriceLayerResources,
  dataTextureView: GPUTextureView
): GPUBindGroup {
  return device.createBindGroup({
    label: 'mid-price.bindGroup',
    layout,
    entries: [
      { binding: 0, resource: { buffer: resources.uniformsBuffer } },
      { binding: 1, resource: dataTextureView },
      { binding: 2, resource: { buffer: resources.descriptorsBuffer } },
    ],
  });
}

/**
 * Two pipelines share the same vertex entry (`vsMidPrice`) and differ
 * only in the fragment entry: `fsMidPriceInterior` paints the coloured
 * core, `fsMidPriceOutline` paints the black annulus. We draw the
 * outline pass first and the interior pass second (per-frame, after
 * the heatmap). Alpha blending then guarantees that the coloured core
 * of any segment overwrites every black pixel it happens to overlap —
 * including outlines that neighbouring segments stamped earlier — so
 * a later segment's outline can no longer "eat" an earlier segment's
 * interior at a turning point.
 *
 * This replaces an earlier stencil-buffer variant that broke Safari's
 * WebGPU pipeline library creation ("Vertex library failed creation").
 * Draw-order ordering keeps the pass free of depth-stencil setup and
 * works across Chrome / Safari uniformly.
 */
function buildMidPricePipelineDescriptor(params: {
  device: GPUDevice;
  module: GPUShaderModule;
  layout: GPUBindGroupLayout;
  format: GPUTextureFormat;
  label: string;
  fragmentEntryPoint: 'fsMidPriceInterior' | 'fsMidPriceOutline';
}): GPURenderPipelineDescriptor {
  const { device, module, layout, format, label, fragmentEntryPoint } = params;

  // Same premultiplied alpha blend the heatmap uses — lets the line
  // sit on top of the heatmap without a colour-correction surprise.
  const alphaBlend: GPUBlendState = {
    color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  };

  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });

  return {
    label,
    layout: pipelineLayout,
    vertex: {
      module,
      entryPoint: 'vsMidPrice',
    },
    fragment: {
      module,
      entryPoint: fragmentEntryPoint,
      targets: [{ format, blend: alphaBlend }],
    },
    primitive: { topology: 'triangle-list' },
    multisample: { count: MSAA_SAMPLE_COUNT },
  };
}

/**
 * Return the raw descriptor so the caller can pick between
 * `createRenderPipeline` (sync, lazy validation — Chrome is happy, but
 * Safari's Metal back-end lazily compiles the shader at first draw and
 * then trips the uncapturederror path with a generic "Vertex library
 * failed creation" message) and `createRenderPipelineAsync`, which
 * forces the full WGSL → MSL compilation up front and surfaces the
 * actual reason via a rejected promise.
 */
export function getMidPriceInteriorPipelineDescriptor(params: {
  device: GPUDevice;
  module: GPUShaderModule;
  layout: GPUBindGroupLayout;
  format: GPUTextureFormat;
}): GPURenderPipelineDescriptor {
  return buildMidPricePipelineDescriptor({
    ...params,
    label: 'mid-price.interior.pipeline',
    fragmentEntryPoint: 'fsMidPriceInterior',
  });
}

export function getMidPriceOutlinePipelineDescriptor(params: {
  device: GPUDevice;
  module: GPUShaderModule;
  layout: GPUBindGroupLayout;
  format: GPUTextureFormat;
}): GPURenderPipelineDescriptor {
  return buildMidPricePipelineDescriptor({
    ...params,
    label: 'mid-price.outline.pipeline',
    fragmentEntryPoint: 'fsMidPriceOutline',
  });
}

export interface IMidPriceUniformValues {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly plotWidthPx: number;
  readonly viewTimeStartDeltaMs: number;
  readonly viewTimeEndDeltaMs: number;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly blockCount: number;
}

/**
 * Fully populate the 64-byte uniform block used by the mid-price
 * shader. Pulls the configurable shader parameters (line widths,
 * slope normalisation) from `domain/constants.ts` so callers don't
 * have to plumb them through.
 */
export function writeMidPriceUniforms(
  device: GPUDevice,
  buffer: GPUBuffer,
  values: IMidPriceUniformValues
): void {
  const data = new ArrayBuffer(MID_PRICE_UNIFORMS_BYTES);
  const floats = new Float32Array(data);
  const uints = new Uint32Array(data);

  floats[0] = values.canvasWidth;
  floats[1] = values.canvasHeight;
  floats[2] = values.plotWidthPx;
  floats[3] = values.viewTimeStartDeltaMs;
  floats[4] = values.viewTimeEndDeltaMs;
  floats[5] = values.priceMin;
  floats[6] = values.priceMax;
  floats[7] = MID_PRICE_MIN_WIDTH_PX;
  floats[8] = MID_PRICE_MAX_WIDTH_PX;
  floats[9] = MID_PRICE_WIDTH_SCALE;
  uints[10] = values.blockCount;
  uints[11] = MID_PRICE_TEXTURE_WIDTH;
  floats[12] = MID_PRICE_OUTLINE_WIDTH_PX;
  // indices 13..15 stay zero (pad to 64 bytes).

  device.queue.writeBuffer(buffer, 0, data);
}

export interface IMidPriceVisibleBlock {
  readonly item: IMidPriceBlockIndexItem;
  readonly textureOffset: number;
}

export interface IMidPriceDescriptorWriteResult {
  readonly totalSamples: number;
  readonly totalSegments: number;
}

/**
 * Pack block descriptors for the mid-price pipeline. Returns the
 * total segment count — exactly `Σ count - 1` per block (one segment
 * between each pair of adjacent samples), which is what the shader
 * instancer expects.
 *
 * A block with fewer than 2 samples contributes zero segments but
 * still occupies a descriptor slot so the shader's binary-search
 * mapping works uniformly.
 */
export function writeMidPriceBlockDescriptors(
  device: GPUDevice,
  buffer: GPUBuffer,
  visibleBlocks: ReadonlyArray<IMidPriceVisibleBlock>,
  globalBaseTimeMs: number
): IMidPriceDescriptorWriteResult {
  assert(
    visibleBlocks.length > 0
      ? buffer.size >= MID_PRICE_BLOCK_DESCRIPTOR_BYTES * visibleBlocks.length
      : true,
    'mid-price: descriptors buffer too small for visible blocks'
  );

  if (visibleBlocks.length === 0) {
    return { totalSamples: 0, totalSegments: 0 };
  }

  const byteLength = MID_PRICE_BLOCK_DESCRIPTOR_BYTES * visibleBlocks.length;
  const data = new ArrayBuffer(byteLength);
  const uints = new Uint32Array(data);
  const floats = new Float32Array(data);

  let totalSamples = 0;
  let totalSegments = 0;
  for (let index = 0; index < visibleBlocks.length; index++) {
    const visible = visibleBlocks[index];
    const base = index * 4;
    uints[base + 0] = visible.textureOffset;
    uints[base + 1] = visible.item.count;
    floats[base + 2] = visible.item.firstTimestampMs - globalBaseTimeMs;
    floats[base + 3] = visible.item.basePrice;
    totalSamples += visible.item.count;
    if (visible.item.count >= 2) {
      totalSegments += visible.item.count - 1;
    }
  }

  device.queue.writeBuffer(buffer, 0, data);
  return { totalSamples, totalSegments };
}

export const MID_PRICE_VERTEX_COUNT_PER_INSTANCE = MID_PRICE_VERTICES_PER_INSTANCE;
