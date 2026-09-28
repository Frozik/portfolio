import { isNil } from 'lodash-es';
import { memo, useEffect, useRef } from 'react';

import { createTimeseriesChart } from '../application/render/create-chart';
import type { ISeriesConfig } from '../domain/types';
import { useSharedRendererState } from './SharedRendererContext';

export const TimeseriesChart = memo(
  ({
    initialTimeStart,
    initialTimeEnd,
    chartSeed,
    seriesConfigs,
  }: {
    readonly initialTimeStart: number;
    readonly initialTimeEnd: number;
    readonly chartSeed: string;
    readonly seriesConfigs: readonly ISeriesConfig[];
  }) => {
    const chartCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const rendererState = useSharedRendererState();
    const renderer = rendererState.status === 'ready' ? rendererState.renderer : undefined;

    useEffect(() => {
      const chartCanvas = chartCanvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      if (isNil(renderer) || isNil(chartCanvas) || isNil(overlayCanvas)) {
        return;
      }
      const chart = createTimeseriesChart({
        renderer,
        seriesConfigs,
        chartCanvas,
        overlayCanvas,
        initialTimeStart,
        initialTimeEnd,
        seed: chartSeed,
      });
      return renderer.registerChart(chart);
    }, [renderer, initialTimeStart, initialTimeEnd, chartSeed, seriesConfigs]);

    return (
      <div className="relative h-full w-full">
        <canvas
          ref={chartCanvasRef}
          className="absolute inset-0 h-full w-full [touch-action:none]"
        />
        <canvas
          ref={overlayCanvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>
    );
  }
);
