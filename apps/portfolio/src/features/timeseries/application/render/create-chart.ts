import { assert } from '@frozik/utils/assert/assert';
import { FpsController } from '@frozik/utils/webgpu/fpsController';
import { isNil } from 'lodash-es';

import { BlockRegistry } from '../../domain/block-registry';
import {
  FPS_IDLE,
  FPS_RESIZE,
  FULL_YEAR_SECONDS,
  GLOBAL_EPOCH_OFFSET,
} from '../../domain/constants';
import { FrameLayoutCache } from '../../domain/frame-layout';
import type { ISeriesConfig } from '../../domain/types';
import { ChartOverlay } from '../../infrastructure/canvas-draw/chart-overlay';
import { CanvasSizeTracker } from '../../infrastructure/canvas-size-tracker';
import { ChartInputController } from '../../infrastructure/chart-input';
import { CrosshairPointer } from '../../infrastructure/crosshair-pointer';
import { GridLayer } from '../../infrastructure/layers/grid-layer';
import { SlotAllocator } from '../../infrastructure/slot-allocator';
import { TextMeasureCache } from '../../infrastructure/text-measure-cache';
import { TimeseriesChartState } from './chart-state';
import { createSeries } from './series-factory';
import type { ISharedTimeseriesRenderer } from './types';
import { ViewportState } from './viewport-state';

const INITIAL_VALUE_MIN = 0;
const INITIAL_VALUE_MAX = 200;

export interface ICreateTimeseriesChartParams {
  readonly renderer: ISharedTimeseriesRenderer;
  readonly seriesConfigs: readonly ISeriesConfig[];
  /** Grid and series are drawn here by the shared device; it also takes the pointer input. */
  readonly chartCanvas: HTMLCanvasElement;
  /** Transparent 2D canvas stacked above `chartCanvas` for axes, labels and loading bars. */
  readonly overlayCanvas: HTMLCanvasElement;
  readonly initialTimeStart: number;
  readonly initialTimeEnd: number;
  readonly seed: string;
}

/** Composition root of one chart: wires the canvases, input, texture slots and series together. */
export function createTimeseriesChart(params: ICreateTimeseriesChartParams): TimeseriesChartState {
  const {
    renderer,
    seriesConfigs,
    chartCanvas,
    overlayCanvas,
    initialTimeStart,
    initialTimeEnd,
    seed,
  } = params;
  const gpuContext = chartCanvas.getContext('webgpu');
  assert(!isNil(gpuContext), 'Failed to get WebGPU context on the chart canvas');
  gpuContext.configure({ device: renderer.device, format: renderer.format, alphaMode: 'opaque' });
  const overlayContext = overlayCanvas.getContext('2d');
  assert(!isNil(overlayContext), 'Failed to get 2D context on the overlay canvas');

  const viewport = new ViewportState({
    viewTimeStart: initialTimeStart,
    viewTimeEnd: initialTimeEnd,
    targetTimeStart: initialTimeStart,
    targetTimeEnd: initialTimeEnd,
    viewValueMin: INITIAL_VALUE_MIN,
    viewValueMax: INITIAL_VALUE_MAX,
  });
  const registry = new BlockRegistry();
  const allocator = new SlotAllocator(renderer.device, {
    onEvict: slot => registry.removeBySlot(slot),
  });
  const { dataPipelines, seriesManager } = createSeries({
    renderer,
    seriesConfigs,
    allocator,
    registry,
    seed,
  });
  const fpsController = new FpsController(FPS_IDLE);
  const inputController = new ChartInputController(
    viewport,
    chartCanvas,
    GLOBAL_EPOCH_OFFSET,
    GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS,
    fpsController
  );
  inputController.attach();
  const crosshairPointer = new CrosshairPointer(chartCanvas, fpsController);
  crosshairPointer.attach();

  let chart: TimeseriesChartState | undefined;
  const canvasSize = new CanvasSizeTracker(
    [chartCanvas, overlayCanvas],
    (newWidth, previousWidth) => {
      chart?.springTimeAxis(newWidth, previousWidth);
    }
  );
  const resizeObserver = new ResizeObserver(() => {
    canvasSize.measure();
    fpsController.raise(FPS_RESIZE);
  });
  resizeObserver.observe(chartCanvas);

  chart = new TimeseriesChartState({
    gpuContext,
    overlay: new ChartOverlay(overlayContext, new TextMeasureCache()),
    viewport,
    canvasSize,
    inputController,
    crosshairPointer,
    fpsController,
    allocator,
    dataPipelines,
    seriesManager,
    gridLayer: new GridLayer(
      renderer.device,
      renderer.resources.gridBindGroupLayout,
      renderer.resources.gridPipeline
    ),
    layoutCache: new FrameLayoutCache(),
    dispose: () => {
      resizeObserver.disconnect();
      gpuContext.unconfigure();
    },
  });
  return chart;
}
