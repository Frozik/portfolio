import { memo, useEffect, useRef } from 'react';

import commonStyles from '../../styles.module.scss';
import { runTimeseries } from '../domain/timeseries-draw';

export const Timeseries = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (canvasRef.current && svgRef.current) {
      return runTimeseries(canvasRef.current, svgRef.current);
    }
  }, []);

  return (
    <div className={`${commonStyles.fixedContainer} relative`}>
      <div className="absolute inset-0 bg-[#262626]" />
      <svg ref={svgRef} className="absolute inset-0 h-full w-full pointer-events-none" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
});
