import { BlockDataPipeline } from '../../domain/block-data-pipeline';
import type { BlockRegistry } from '../../domain/block-registry';
import {
  VERTICES_PER_CANDLESTICK,
  VERTICES_PER_RHOMBUS,
  VERTICES_PER_SEGMENT,
} from '../../domain/constants';
import type { ISeriesConfig } from '../../domain/types';
import { EChartType } from '../../domain/types';
import { SeriesLayer } from '../../infrastructure/layers/series-layer';
import { SeriesLayerManager } from '../../infrastructure/layers/series-layer-manager';
import type { SlotAllocator } from '../../infrastructure/slot-allocator';

import type { ISharedTimeseriesRenderer } from './types';

function getVerticesPerInstance(chartType: EChartType): number {
  switch (chartType) {
    case EChartType.Line:
      return VERTICES_PER_SEGMENT;
    case EChartType.Candlestick:
      return VERTICES_PER_CANDLESTICK;
    case EChartType.Rhombus:
      return VERTICES_PER_RHOMBUS;
  }
}

function getNeedsStitching(chartType: EChartType): boolean {
  switch (chartType) {
    case EChartType.Line:
    case EChartType.Candlestick:
      return true;
    case EChartType.Rhombus:
      return false;
  }
}

function getGpuPipeline(
  chartType: EChartType,
  renderer: ISharedTimeseriesRenderer
): GPURenderPipeline {
  switch (chartType) {
    case EChartType.Line:
      return renderer.linePipeline;
    case EChartType.Candlestick:
      return renderer.candlestickPipeline;
    case EChartType.Rhombus:
      return renderer.rhombusPipeline;
  }
}

/**
 * Build one data pipeline + GPU layer per series config, all sharing the
 * chart's single slot allocator (one texture) and block registry (one RTree).
 * The returned manager is already initialised and bound to the allocator view.
 */
export function createSeries({
  renderer,
  seriesConfigs,
  allocator,
  registry,
  seed,
}: {
  readonly renderer: ISharedTimeseriesRenderer;
  readonly seriesConfigs: readonly ISeriesConfig[];
  readonly allocator: SlotAllocator;
  readonly registry: BlockRegistry;
  readonly seed: string;
}): { readonly dataPipelines: BlockDataPipeline[]; readonly seriesManager: SeriesLayerManager } {
  const dataPipelines: BlockDataPipeline[] = [];
  const seriesManager = new SeriesLayerManager();

  for (const config of seriesConfigs) {
    dataPipelines.push(
      new BlockDataPipeline(
        allocator,
        registry,
        `${seed}${config.seedSuffix}`,
        config.chartType,
        config.colorFn,
        config.sizeFn,
        () => renderer.instantLoad
      )
    );

    const layer = new SeriesLayer(
      getVerticesPerInstance(config.chartType),
      getNeedsStitching(config.chartType)
    );
    seriesManager.addSeries(layer, getGpuPipeline(config.chartType, renderer));
  }

  seriesManager.initAll(renderer.device, renderer.bindGroupLayout, allocator);
  seriesManager.updateBindGroups(allocator.createView());

  return { dataPipelines, seriesManager };
}
