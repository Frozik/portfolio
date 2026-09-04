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
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererState = useSharedRendererState();
    const renderer = rendererState.status === 'ready' ? rendererState.renderer : undefined;

    useEffect(() => {
      const targetCanvas = canvasRef.current;
      if (isNil(renderer) || isNil(targetCanvas)) {
        return;
      }
      const chart = createTimeseriesChart({
        renderer,
        seriesConfigs,
        targetCanvas,
        initialTimeStart,
        initialTimeEnd,
        seed: chartSeed,
      });
      return renderer.registerChart(chart);
    }, [renderer, initialTimeStart, initialTimeEnd, chartSeed, seriesConfigs]);

    return (
      <div className="relative h-full w-full">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full [touch-action:none]" />
      </div>
    );
  }
);
