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
import { CanvasSizeTracker } from '../../infrastructure/canvas-size-tracker';
import { ChartInputController } from '../../infrastructure/chart-input';
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
  readonly targetCanvas: HTMLCanvasElement;
  readonly initialTimeStart: number;
  readonly initialTimeEnd: number;
  readonly seed: string;
}

/** Composition root of one chart: wires the canvas, input, texture slots and series together. */
export function createTimeseriesChart(params: ICreateTimeseriesChartParams): TimeseriesChartState {
  const { renderer, seriesConfigs, targetCanvas, initialTimeStart, initialTimeEnd, seed } = params;
  const target2dContext = targetCanvas.getContext('2d');
  assert(!isNil(target2dContext), 'Failed to get 2D canvas context');

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
    targetCanvas,
    GLOBAL_EPOCH_OFFSET,
    GLOBAL_EPOCH_OFFSET + FULL_YEAR_SECONDS,
    fpsController
  );
  inputController.attach();

  let chart: TimeseriesChartState | undefined;
  const canvasSize = new CanvasSizeTracker(targetCanvas, (newWidth, previousWidth) => {
    chart?.springTimeAxis(newWidth, previousWidth);
  });
  const resizeObserver = new ResizeObserver(() => {
    canvasSize.measure();
    fpsController.raise(FPS_RESIZE);
  });
  resizeObserver.observe(targetCanvas);

  chart = new TimeseriesChartState({
    target2dContext,
    viewport,
    canvasSize,
    inputController,
    fpsController,
    allocator,
    dataPipelines,
    seriesManager,
    textMeasurer: new TextMeasureCache(),
    layoutCache: new FrameLayoutCache(),
    dispose: () => resizeObserver.disconnect(),
  });
  return chart;
}
