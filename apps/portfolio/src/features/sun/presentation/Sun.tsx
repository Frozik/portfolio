import { memo, useEffect, useRef } from 'react';
import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import commonStyles from '../../../shared/styles.module.scss';
import { runSun } from '../domain/sun-draw';

export const Sun = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      return runSun(canvasRef.current);
    }

    return undefined;
  }, []);

  return (
    <WebGpuGuard className={commonStyles.fixedContainer}>
      <div className={commonStyles.fixedContainer}>
        <canvas ref={canvasRef} className="h-full w-full [touch-action:none]" />
      </div>
    </WebGpuGuard>
  );
});
