import { isNil } from 'lodash-es';
import { memo, useEffect, useRef } from 'react';

import { TimeseriesChartState } from '../application/render/chart-state';
import type { ISeriesConfig } from '../domain/types';
import { useSharedRendererState } from './SharedRendererContext';

export const TimeseriesChart = memo(
  ({
    initialTimeStart,
    initialTimeEnd,
    chartSeed,
    seriesConfigs,
  }: {
    initialTimeStart: number;
    initialTimeEnd: number;
    chartSeed: string;
    seriesConfigs: readonly ISeriesConfig[];
  }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { renderer } = useSharedRendererState();

    useEffect(() => {
      if (isNil(renderer) || isNil(canvasRef.current)) {
        return;
      }

      const chartState = new TimeseriesChartState(
        renderer,
        seriesConfigs,
        canvasRef.current,
        initialTimeStart,
        initialTimeEnd,
        chartSeed
      );

      return renderer.registerChart(chartState);
    }, [renderer, initialTimeStart, initialTimeEnd, chartSeed, seriesConfigs]);

    return (
      <div className="relative h-full w-full">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full [touch-action:none]" />
      </div>
    );
  }
);
