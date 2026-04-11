import { isNil } from 'lodash-es';
import { memo, useEffect, useRef } from 'react';

import { TimeseriesChartState } from '../domain/chart-state';
import type { ISeriesConfig } from '../domain/types';
import { useSharedRenderer } from './SharedRendererContext';

interface ITimeseriesChartProps {
  initialTimeStart: number;
  initialTimeEnd: number;
  chartSeed: string;
  seriesConfigs: readonly ISeriesConfig[];
}

export const TimeseriesChart = memo(
  ({ initialTimeStart, initialTimeEnd, chartSeed, seriesConfigs }: ITimeseriesChartProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const axesSvgRef = useRef<SVGSVGElement>(null);
    const renderer = useSharedRenderer();

    useEffect(() => {
      if (isNil(renderer) || isNil(canvasRef.current) || isNil(axesSvgRef.current)) {
        return;
      }

      const chartState = new TimeseriesChartState(
        renderer.device,
        renderer.bindGroupLayout,
        renderer,
        seriesConfigs,
        canvasRef.current,
        axesSvgRef.current,
        initialTimeStart,
        initialTimeEnd,
        chartSeed
      );

      return renderer.registerChart(chartState);
    }, [renderer, initialTimeStart, initialTimeEnd, chartSeed, seriesConfigs]);

    return (
      <div className="relative h-full w-full bg-[#1a1a1a]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <svg ref={axesSvgRef} className="absolute inset-0 h-full w-full pointer-events-none" />
      </div>
    );
  }
);
