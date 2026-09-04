import { memo } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { useGpuCanvas } from '../../../shared/hooks/useGpuCanvas';
import { runCharter } from '../application/render/chart-draw';

export const Charts = memo(() => {
  const canvasRef = useGpuCanvas(runCharter);

  return (
    <WebGpuGuard className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </WebGpuGuard>
  );
});
