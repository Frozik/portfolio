import { memo, useEffect, useRef } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { runCharter } from '../domain/chart-draw';

export const Charts = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      return runCharter(canvasRef.current);
    }

    return undefined;
  }, []);

  return (
    <WebGpuGuard className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </WebGpuGuard>
  );
});
