import { memo, useEffect, useRef } from 'react';
import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import commonStyles from '../../../shared/styles.module.scss';
import { runStereometry } from '../domain/stereometry-draw';

export const Stereometry = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      return runStereometry(canvasRef.current);
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
