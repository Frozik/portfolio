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
import type { ISharedGpuResources } from '../../infrastructure/shared-gpu-resources';
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

function getGpuPipeline(chartType: EChartType, resources: ISharedGpuResources): GPURenderPipeline {
  switch (chartType) {
    case EChartType.Line:
      return resources.linePipeline;
    case EChartType.Candlestick:
      return resources.candlestickPipeline;
    case EChartType.Rhombus:
      return resources.rhombusPipeline;
  }
}

/** One data pipeline and GPU layer per series, sharing the chart's texture slots and block index. */
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
      renderer.device,
      renderer.resources.bindGroupLayout,
      allocator,
      getVerticesPerInstance(config.chartType),
      getNeedsStitching(config.chartType)
    );
    seriesManager.addSeries(layer, getGpuPipeline(config.chartType, renderer.resources));
  }

  seriesManager.updateBindGroups(allocator.createView());

  return { dataPipelines, seriesManager };
}
