import { assert } from '@frozik/utils/assert/assert';
import { EValueDescriptorErrorCode } from '@frozik/utils/value-descriptors/codes';
import { Fail } from '@frozik/utils/value-descriptors/fails/fail';
import { toFail } from '@frozik/utils/value-descriptors/fails/utils';
import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';
import { isNil } from 'lodash-es';

import { TEXTURE_WIDTH_FALLBACK, TEXTURE_WIDTH_PREFERRED } from '../../domain/constants';
import { getTextureLayoutConfig } from '../../domain/math';
import type { IChartCanvases } from '../../domain/ports/chart-renderer';
import type { ITextureLayoutConfig } from '../../domain/types';
import candleCommonWgsl from '../shaders/candle-common.wgsl?raw';
import candleWgsl from '../shaders/candle.wgsl?raw';
import commonWgsl from '../shaders/common.wgsl?raw';
import gridWgsl from '../shaders/grid.wgsl?raw';
import heatmapWgsl from '../shaders/heatmap.wgsl?raw';
import tradesCommonWgsl from '../shaders/trades-common.wgsl?raw';
import tradesWgsl from '../shaders/trades.wgsl?raw';
import {
  createCandleBindGroupLayout,
  getCandlePipelineDescriptor,
  getMovingAveragePipelineDescriptor,
} from './candle-buffers';
import { reportShaderDiagnostics, reportUncapturedDeviceErrors } from './gpu-diagnostics';
import { createGridBindGroupLayout, getGridPipelineDescriptor } from './grid-buffers';
import { createHeatmapBindGroupLayout, getHeatmapPipelineDescriptor } from './heatmap-buffers';
import { createTradesBindGroupLayout, getVolumeBarsPipelineDescriptor } from './trades-buffers';

const heatmapShaderSource = commonWgsl + heatmapWgsl;
const candleShaderSource = candleCommonWgsl + candleWgsl;
const tradesShaderSource = tradesCommonWgsl + tradesWgsl;

export interface IRendererResources {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly context: GPUCanvasContext;
  readonly overlay2d: CanvasRenderingContext2D;
  readonly layout: ITextureLayoutConfig;
  readonly gridBindGroupLayout: GPUBindGroupLayout;
  readonly gridPipeline: GPURenderPipeline;
  readonly heatmapBindGroupLayout: GPUBindGroupLayout;
  readonly heatmapPipeline: GPURenderPipeline;
  readonly candleBindGroupLayout: GPUBindGroupLayout;
  readonly candlePipeline: GPURenderPipeline;
  readonly movingAverageShortPipeline: GPURenderPipeline;
  readonly movingAverageLongPipeline: GPURenderPipeline;
  readonly tradesBindGroupLayout: GPUBindGroupLayout;
  readonly volumeBarsPipeline: GPURenderPipeline;
}

export type RendererResourcesInit =
  | { readonly kind: 'ready'; readonly resources: IRendererResources }
  | { readonly kind: 'unsupported'; readonly reason: ValueDescriptorFail };

function unsupported(message: string): RendererResourcesInit {
  return { kind: 'unsupported', reason: Fail(EValueDescriptorErrorCode.UNAVAILABLE, { message }) };
}

async function requestDevice(adapter: GPUAdapter): Promise<GPUDevice | ValueDescriptorFail> {
  const requiredLimits: Record<string, number> = {};
  if (adapter.limits.maxTextureDimension2D >= TEXTURE_WIDTH_PREFERRED) {
    requiredLimits.maxTextureDimension2D = TEXTURE_WIDTH_PREFERRED;
  }
  try {
    return await adapter.requestDevice({ requiredLimits });
  } catch (error) {
    return toFail(error);
  }
}

function createShaderModule(device: GPUDevice, code: string, label: string): GPUShaderModule {
  const module = device.createShaderModule({ code, label });
  reportShaderDiagnostics(module, label);
  return module;
}

/**
 * Brings up the adapter, device, the WebGPU context of the chart canvas,
 * the 2D context of the overlay canvas and every pipeline. Pipelines
 * compile asynchronously so a WGSL failure surfaces here with the real
 * error text instead of a generic message at first draw.
 */
export async function initRendererResources(
  canvases: IChartCanvases
): Promise<RendererResourcesInit> {
  assert(!isNil(navigator.gpu), 'WebGPU is not supported');

  const adapter = await navigator.gpu.requestAdapter();
  if (isNil(adapter)) {
    return unsupported('WebGPU adapter is not available');
  }

  const device = await requestDevice(adapter);
  if (!(device instanceof GPUDevice)) {
    return { kind: 'unsupported', reason: device };
  }
  reportUncapturedDeviceErrors(device);

  const supportedLimit = device.limits.maxTextureDimension2D;
  if (supportedLimit < TEXTURE_WIDTH_FALLBACK) {
    device.destroy();
    return unsupported(
      `maxTextureDimension2D ${supportedLimit} is below ${TEXTURE_WIDTH_FALLBACK}`
    );
  }

  const layout = getTextureLayoutConfig(supportedLimit);

  const context = canvases.chartCanvas.getContext('webgpu');
  assert(!isNil(context), 'Failed to get WebGPU context on the chart canvas');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });

  const overlay2d = canvases.overlayCanvas.getContext('2d');
  assert(!isNil(overlay2d), 'Failed to get 2D context on the overlay canvas');

  const gridModule = createShaderModule(device, gridWgsl, 'grid.shader');
  const heatmapModule = createShaderModule(device, heatmapShaderSource, 'heatmap.shader');
  const candleModule = createShaderModule(device, candleShaderSource, 'candles.shader');
  const tradesModule = createShaderModule(device, tradesShaderSource, 'trades.shader');

  const gridBindGroupLayout = createGridBindGroupLayout(device);
  const heatmapBindGroupLayout = createHeatmapBindGroupLayout(device);
  const candleBindGroupLayout = createCandleBindGroupLayout(device);
  const tradesBindGroupLayout = createTradesBindGroupLayout(device);

  try {
    const candlePipelineParams = {
      device,
      module: candleModule,
      layout: candleBindGroupLayout,
      format,
    };
    const [
      gridPipeline,
      heatmapPipeline,
      candlePipeline,
      movingAverageShortPipeline,
      movingAverageLongPipeline,
      volumeBarsPipeline,
    ] = await Promise.all([
      device.createRenderPipelineAsync(
        getGridPipelineDescriptor({
          device,
          module: gridModule,
          layout: gridBindGroupLayout,
          format,
        })
      ),
      device.createRenderPipelineAsync(
        getHeatmapPipelineDescriptor({
          device,
          module: heatmapModule,
          layout: heatmapBindGroupLayout,
          format,
          layoutConfig: layout,
        })
      ),
      device.createRenderPipelineAsync(getCandlePipelineDescriptor(candlePipelineParams)),
      device.createRenderPipelineAsync(
        getMovingAveragePipelineDescriptor(candlePipelineParams, 'short')
      ),
      device.createRenderPipelineAsync(
        getMovingAveragePipelineDescriptor(candlePipelineParams, 'long')
      ),
      device.createRenderPipelineAsync(
        getVolumeBarsPipelineDescriptor({
          device,
          module: tradesModule,
          layout: tradesBindGroupLayout,
          format,
        })
      ),
    ]);

    return {
      kind: 'ready',
      resources: {
        device,
        format,
        context,
        overlay2d,
        layout,
        gridBindGroupLayout,
        gridPipeline,
        heatmapBindGroupLayout,
        heatmapPipeline,
        candleBindGroupLayout,
        candlePipeline,
        movingAverageShortPipeline,
        movingAverageLongPipeline,
        tradesBindGroupLayout,
        volumeBarsPipeline,
      },
    };
  } catch (error) {
    device.destroy();
    return { kind: 'unsupported', reason: toFail(error) };
  }
}
