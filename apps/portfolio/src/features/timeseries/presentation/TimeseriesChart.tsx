import { isNil } from 'lodash-es';
import { memo, useEffect, useRef } from 'react';

import { TimeseriesChartState } from '../domain/chart-state';
import { useSharedRenderer } from './SharedRendererContext';

interface ITimeseriesChartProps {
  initialTimeStart: number;
  initialTimeEnd: number;
}

export const TimeseriesChart = memo(
  ({ initialTimeStart, initialTimeEnd }: ITimeseriesChartProps) => {
    const gridSvgRef = useRef<SVGSVGElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const axesSvgRef = useRef<SVGSVGElement>(null);
    const renderer = useSharedRenderer();

    useEffect(() => {
      if (
        isNil(renderer) ||
        isNil(gridSvgRef.current) ||
        isNil(canvasRef.current) ||
        isNil(axesSvgRef.current)
      ) {
        return;
      }

      const chartState = new TimeseriesChartState(
        renderer.device,
        renderer.bindGroupLayout,
        canvasRef.current,
        gridSvgRef.current,
        axesSvgRef.current,
        initialTimeStart,
        initialTimeEnd
      );

      return renderer.registerChart(chartState);
    }, [renderer, initialTimeStart, initialTimeEnd]);

    return (
      <div className="relative h-full w-full">
        <svg
          ref={gridSvgRef}
          className="absolute inset-0 h-full w-full bg-[#262626] pointer-events-none"
        />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <svg ref={axesSvgRef} className="absolute inset-0 h-full w-full pointer-events-none" />
      </div>
    );
  }
);
