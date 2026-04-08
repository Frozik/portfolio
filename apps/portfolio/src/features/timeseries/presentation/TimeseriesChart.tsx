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
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const renderer = useSharedRenderer();

    useEffect(() => {
      if (isNil(renderer) || isNil(canvasRef.current) || isNil(svgRef.current)) {
        return;
      }

      const chartState = new TimeseriesChartState(
        renderer.device,
        renderer.bindGroupLayout,
        canvasRef.current,
        svgRef.current,
        initialTimeStart,
        initialTimeEnd
      );

      return renderer.registerChart(chartState);
    }, [renderer, initialTimeStart, initialTimeEnd]);

    return (
      <div className="relative h-full w-full">
        <div className="absolute inset-0 bg-[#262626]" />
        <svg ref={svgRef} className="absolute inset-0 h-full w-full pointer-events-none" />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>
    );
  }
);
