import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import {
  INITIAL_OFFSCREEN_HEIGHT,
  INITIAL_OFFSCREEN_WIDTH,
  TEXTURE_WIDTH_FALLBACK,
  TEXTURE_WIDTH_PREFERRED,
} from '../../domain/constants';
import { getTextureLayoutConfig } from '../../domain/math';
import type { ITextureLayoutConfig } from '../../domain/types';
import {
  createHeatmapBindGroupLayout,
  getHeatmapPipelineDescriptor,
} from '../../infrastructure/heatmap-layer';
import {
  createMidPriceBindGroupLayout,
  getMidPriceInteriorPipelineDescriptor,
  getMidPriceOutlinePipelineDescriptor,
} from '../../infrastructure/mid-price-layer';
import commonWgsl from '../../infrastructure/shaders/common.wgsl?raw';
import heatmapWgsl from '../../infrastructure/shaders/heatmap.wgsl?raw';
import midPriceWgsl from '../../infrastructure/shaders/mid-price.wgsl?raw';
import midPriceCommonWgsl from '../../infrastructure/shaders/mid-price-common.wgsl?raw';
import tradesWgsl from '../../infrastructure/shaders/trades.wgsl?raw';
import tradesCommonWgsl from '../../infrastructure/shaders/trades-common.wgsl?raw';
import {
  createTradesBindGroupLayout,
  getTradesPipelineDescriptor,
} from '../../infrastructure/trades-layer';

import { createPipelineWithLogging, logShaderDiagnostics } from './diagnostics';

const heatmapShaderSource = commonWgsl + heatmapWgsl;
const midPriceShaderSource = midPriceCommonWgsl + midPriceWgsl;
const tradesShaderSource = tradesCommonWgsl + tradesWgsl;

// RENDER_ATTACHMENT (0x10) + COPY_DST (0x02) — offscreen canvas texture
// is used both as a render target (during swapchain acquire) and as a
// copy destination for the intermediate render target (Approach D).
export const OFFSCREEN_CTX_USAGE = 0x10 | 0x02;

export interface IRendererResources {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly offscreen: OffscreenCanvas;
  readonly context: GPUCanvasContext;
  readonly target2d: CanvasRenderingContext2D;
  readonly layout: ITextureLayoutConfig;
  readonly heatmapBindGroupLayout: GPUBindGroupLayout;
  readonly heatmapPipeline: GPURenderPipeline;
  readonly midPriceBindGroupLayout: GPUBindGroupLayout;
  readonly midPriceInteriorPipeline: GPURenderPipeline;
  readonly midPriceOutlinePipeline: GPURenderPipeline;
  readonly tradesBindGroupLayout: GPUBindGroupLayout;
  readonly tradesPipeline: GPURenderPipeline;
}

/**
 * Bring up the WebGPU adapter, device, offscreen canvas, shader modules,
 * bind-group layouts, and all four render pipelines used by the chart.
 * Async pipeline creation forces WGSL→MSL compilation up-front so any
 * shader/validation failure surfaces with the real error text (logged by
 * `createPipelineWithLogging`) rather than a generic
 * `Vertex library failed creation` later in `uncapturederror`.
 *
 * Returns `null` when WebGPU isn't available, the adapter request fails,
 * the device can't meet the texture-dimension floor, or any pipeline
 * fails to compile — the caller treats that as "WebGPU unsupported".
 */
export async function initRendererResources(
  canvas: HTMLCanvasElement
): Promise<IRendererResources | null> {
  assert(!isNil(navigator.gpu), 'WebGPU is not supported');

  const adapter = await navigator.gpu.requestAdapter();
  if (isNil(adapter)) {
    return null;
  }

  const preferredMax = TEXTURE_WIDTH_PREFERRED;
  const supportsPreferred = adapter.limits.maxTextureDimension2D >= preferredMax;
  const requestedLimits: Record<string, number> = {};
  if (supportsPreferred) {
    requestedLimits.maxTextureDimension2D = preferredMax;
  }

  let device: GPUDevice;
  try {
    device = await adapter.requestDevice({ requiredLimits: requestedLimits });
  } catch {
    return null;
  }

  // Surface every uncaptured validation / internal / out-of-memory
  // error from the device. Safari's WebGPU in particular has
  // historically been silent on pipeline / render-pass issues —
  // without this handler a broken pipeline state or a format
  // mismatch produces a blank canvas with no console output.
  // Catches errors for the device's whole lifetime.
  device.addEventListener('uncapturederror', event => {
    const gpuEvent = event as GPUUncapturedErrorEvent;
    const error = gpuEvent.error;
    // biome-ignore lint/suspicious/noConsole: surfaces WebGPU device errors that would otherwise be invisible
    console.error(
      `binance-view: webgpu uncapturederror (${error.constructor.name}) —`,
      error.message
    );
  });

  const supportedLimit = device.limits.maxTextureDimension2D;
  if (supportedLimit < TEXTURE_WIDTH_FALLBACK) {
    device.destroy();
    return null;
  }

  const layout = getTextureLayoutConfig(supportedLimit);

  const offscreen = new OffscreenCanvas(INITIAL_OFFSCREEN_WIDTH, INITIAL_OFFSCREEN_HEIGHT);
  const context = offscreen.getContext('webgpu');
  assert(!isNil(context), 'Failed to get WebGPU context on OffscreenCanvas');

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied', usage: OFFSCREEN_CTX_USAGE });

  const target2d = canvas.getContext('2d');
  assert(!isNil(target2d), 'Failed to get 2D context on visible canvas');

  const heatmapModule = device.createShaderModule({
    code: heatmapShaderSource,
    label: 'heatmap.shader',
  });
  logShaderDiagnostics(heatmapModule, 'heatmap.shader');
  const midPriceModule = device.createShaderModule({
    code: midPriceShaderSource,
    label: 'mid-price.shader',
  });
  logShaderDiagnostics(midPriceModule, 'mid-price.shader');
  const tradesModule = device.createShaderModule({
    code: tradesShaderSource,
    label: 'trades.shader',
  });
  logShaderDiagnostics(tradesModule, 'trades.shader');

  const heatmapBindGroupLayout = createHeatmapBindGroupLayout(device);
  const midPriceBindGroupLayout = createMidPriceBindGroupLayout(device);
  const tradesBindGroupLayout = createTradesBindGroupLayout(device);

  const [heatmapPipeline, midPriceInteriorPipeline, midPriceOutlinePipeline, tradesPipeline] =
    await Promise.all([
      createPipelineWithLogging(
        device,
        'heatmap',
        getHeatmapPipelineDescriptor({
          device,
          module: heatmapModule,
          layout: heatmapBindGroupLayout,
          format,
          layoutConfig: layout,
        })
      ),
      createPipelineWithLogging(
        device,
        'mid-price.interior',
        getMidPriceInteriorPipelineDescriptor({
          device,
          module: midPriceModule,
          layout: midPriceBindGroupLayout,
          format,
        })
      ),
      createPipelineWithLogging(
        device,
        'mid-price.outline',
        getMidPriceOutlinePipelineDescriptor({
          device,
          module: midPriceModule,
          layout: midPriceBindGroupLayout,
          format,
        })
      ),
      createPipelineWithLogging(
        device,
        'trades',
        getTradesPipelineDescriptor({
          device,
          module: tradesModule,
          layout: tradesBindGroupLayout,
          format,
        })
      ),
    ]);

  if (
    heatmapPipeline === null ||
    midPriceInteriorPipeline === null ||
    midPriceOutlinePipeline === null ||
    tradesPipeline === null
  ) {
    device.destroy();
    return null;
  }

  return {
    device,
    format,
    offscreen,
    context,
    target2d,
    layout,
    heatmapBindGroupLayout,
    heatmapPipeline,
    midPriceBindGroupLayout,
    midPriceInteriorPipeline,
    midPriceOutlinePipeline,
    tradesBindGroupLayout,
    tradesPipeline,
  };
}
