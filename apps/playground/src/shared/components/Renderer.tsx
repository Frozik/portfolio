import { isNil } from 'lodash-es';
import { memo, useEffect, useRef } from 'react';
import { cn } from '../lib/cn';

import styles from './styles.module.scss';

export const Renderer = memo(
  ({
    className,
    width,
    height,
    onCanvasContext,
  }: {
    className?: string;
    width: number;
    height: number;
    onCanvasContext: (contexts: {
      staticContext: CanvasRenderingContext2D;
      context: CanvasRenderingContext2D;
    }) => void;
  }) => {
    const staticCanvasRef = useRef<HTMLCanvasElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const staticContext = staticCanvasRef.current?.getContext('2d', { alpha: false });
      const context = canvasRef.current?.getContext('2d', { alpha: true });

      if (!isNil(context) && !isNil(staticContext)) {
        onCanvasContext({
          staticContext,
          context,
        });
      }
    }, [onCanvasContext]);

    return (
      <div className={cn(className)}>
        <canvas className={styles.canvas} ref={staticCanvasRef} width={width} height={height} />
        <canvas className={styles.canvas} ref={canvasRef} width={width} height={height} />
      </div>
    );
  }
);
