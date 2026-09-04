import { memo } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { useGpuCanvas } from '../../../shared/hooks/useGpuCanvas';
import { runSun } from '../application/render/sun-draw';

export const Sun = memo(() => {
  const canvasRef = useGpuCanvas(runSun);

  return (
    <WebGpuGuard className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full [touch-action:none]" />
    </WebGpuGuard>
  );
});
