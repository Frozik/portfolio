import { memo, useEffect, useRef } from 'react';
import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import commonStyles from '../../styles.module.scss';
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
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </WebGpuGuard>
  );
});
