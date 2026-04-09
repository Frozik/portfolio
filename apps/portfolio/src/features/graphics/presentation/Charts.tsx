import { memo, useEffect, useRef } from 'react';

import commonStyles from '../../styles.module.scss';
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
    <div className={commonStyles.fixedContainer}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
});
