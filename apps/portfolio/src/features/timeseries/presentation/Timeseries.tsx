import { packColor, unpackColor } from '@frozik/utils/webgpu/colorPacking';
import { memo } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { CHART_ZOOM_LEVELS, GLOBAL_EPOCH_OFFSET } from '../domain/constants';
import type { IDataPoint, ISeriesConfig } from '../domain/types';
import { EChartType } from '../domain/types';
import { DebugOverlay } from './DebugOverlay';
import { SharedRendererProvider, useSharedRenderer } from './SharedRendererContext';
import { TimeseriesChart } from './TimeseriesChart';

const RHOMBUS_RED_THRESHOLD = 110;
const RHOMBUS_ORANGE_THRESHOLD = 105;
const RHOMBUS_GREEN_THRESHOLD = 100;
const RHOMBUS_BLUE_THRESHOLD = 95;

const RHOMBUS_COLOR_RED = packColor(0.9, 0.2, 0.2, 1.0);
const RHOMBUS_COLOR_ORANGE = packColor(1.0, 0.6, 0.1, 1.0);
const RHOMBUS_COLOR_GREEN = packColor(0.2, 0.8, 0.3, 1.0);
const RHOMBUS_COLOR_BLUE = packColor(0.2, 0.5, 0.9, 1.0);
const RHOMBUS_COLOR_DEFAULT = packColor(0.7, 0.7, 0.7, 1.0);

const LINE_LIGHT_BLUE_COLOR = packColor(0, 0.5, 1.0, 1.0);
const LINE_LIGHT_BLUE_SIZE = 10;
const CANDLESTICK_ALPHA = 0.6;
const LINE_ORANGE_COLOR = packColor(1.0, 0.6, 0.1, 1.0);

const LINE_SIZE_LEVEL_1 = 2;
const LINE_SIZE_LEVEL_2 = 4;
const LINE_SIZE_LEVEL_3 = 6;
const LINE_SIZE_LEVEL_4 = 8;
const LINE_SIZE_LEVEL_5 = 10;

function lineSizeByValue(value: number): number {
  if (value > RHOMBUS_RED_THRESHOLD) {
    return LINE_SIZE_LEVEL_5;
  }
  if (value > RHOMBUS_ORANGE_THRESHOLD) {
    return LINE_SIZE_LEVEL_4;
  }
  if (value > RHOMBUS_GREEN_THRESHOLD) {
    return LINE_SIZE_LEVEL_3;
  }
  if (value > RHOMBUS_BLUE_THRESHOLD) {
    return LINE_SIZE_LEVEL_2;
  }
  return LINE_SIZE_LEVEL_1;
}

function rhombusColorByValue(value: number): number {
  if (value > RHOMBUS_RED_THRESHOLD) {
    return RHOMBUS_COLOR_RED;
  }
  if (value > RHOMBUS_ORANGE_THRESHOLD) {
    return RHOMBUS_COLOR_ORANGE;
  }
  if (value > RHOMBUS_GREEN_THRESHOLD) {
    return RHOMBUS_COLOR_DEFAULT;
  }
  if (value > RHOMBUS_BLUE_THRESHOLD) {
    return RHOMBUS_COLOR_GREEN;
  }
  return RHOMBUS_COLOR_BLUE;
}

/** Series configurations for each of the 4 charts in the grid. */
const CHART_SERIES_CONFIGS: readonly (readonly ISeriesConfig[])[] = [
  // Top-left: thick light-blue line + 20% transparent candlestick
  [
    {
      chartType: EChartType.Line,
      seedSuffix: '',
      colorFn: () => LINE_LIGHT_BLUE_COLOR,
      sizeFn: () => LINE_LIGHT_BLUE_SIZE,
    },
    {
      chartType: EChartType.Candlestick,
      seedSuffix: '-series-2',
      colorFn: (_value: number, index: number, points: readonly IDataPoint[]) => {
        const original = unpackColor(points[index].color);
        return packColor(original.r, original.g, original.b, CANDLESTICK_ALPHA);
      },
    },
  ],
  // Top-right: candlestick only
  [{ chartType: EChartType.Candlestick, seedSuffix: '' }],
  // Bottom-left: line with value-based thickness, orange color
  [
    {
      chartType: EChartType.Line,
      seedSuffix: '',
      colorFn: () => LINE_ORANGE_COLOR,
      sizeFn: (value: number) => lineSizeByValue(value),
    },
  ],
  // Bottom-right: rhombus with value-based coloring
  [
    {
      chartType: EChartType.Rhombus,
      seedSuffix: '',
      colorFn: (value: number) => rhombusColorByValue(value),
    },
  ],
];

const TimeseriesContent = memo(() => {
  const renderer = useSharedRenderer();

  return (
    <div className="h-full w-full relative grid grid-cols-2 grid-rows-2">
      <DebugOverlay renderer={renderer} />
      {CHART_ZOOM_LEVELS.map((level, index) => (
        <TimeseriesChart
          key={`${level[0]}-${level[1]}`}
          initialTimeStart={GLOBAL_EPOCH_OFFSET + level[0]}
          initialTimeEnd={GLOBAL_EPOCH_OFFSET + level[1]}
          chartSeed={`chart-${index}`}
          seriesConfigs={CHART_SERIES_CONFIGS[index]}
        />
      ))}
    </div>
  );
});

export const Timeseries = memo(() => {
  return (
    <WebGpuGuard className="h-full w-full">
      <SharedRendererProvider>
        <TimeseriesContent />
      </SharedRendererProvider>
    </WebGpuGuard>
  );
});
