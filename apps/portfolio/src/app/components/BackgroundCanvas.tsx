import { memo, useEffect, useRef, useState } from 'react';
import { useAmbientCanvas } from '../../shared/hooks/useAmbientCanvas';
import { createBackgroundCanvasAnimation } from './background-canvas-animation';

const DEFAULT_OPACITY = 0.75;

const BackgroundCanvasComponent = ({
  opacity = DEFAULT_OPACITY,
}: {
  readonly opacity?: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animation] = useState(createBackgroundCanvasAnimation);

  useEffect(() => {
    // Mouse drives the interactive gradient centre. The ambient hook owns no
    // pointer input, so the listener lives here — and, matching the original,
    // only when motion is allowed (a static frame has no parallax to follow).
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return undefined;
    }
    const handleMouseMove = (event: MouseEvent): void => {
      const canvas = canvasRef.current;
      if (canvas === null) {
        return;
      }
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) {
        return;
      }
      animation.setPointer(event.clientX / width, event.clientY / height);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [animation]);

  useAmbientCanvas(canvasRef, animation);

  return (
    <div className="print:hidden">
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0 h-dvh w-dvw"
        style={{ opacity }}
      />
      <div
        aria-hidden="true"
        className={[
          'pointer-events-none fixed inset-0 z-[1] opacity-[0.04]',
          'bg-[url("data:image/svg+xml,%3Csvg%20viewBox%3D%270%200%20200%20200%27%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%3E%3Cfilter%20id%3D%27n%27%3E%3CfeTurbulence%20baseFrequency%3D%270.9%27%20numOctaves%3D%273%27%20stitchTiles%3D%27stitch%27/%3E%3C/filter%3E%3Crect%20width%3D%27100%25%27%20height%3D%27100%25%27%20filter%3D%27url(%23n)%27/%3E%3C/svg%3E")]',
        ].join(' ')}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(120%_80%_at_50%_20%,transparent_40%,rgba(0,0,0,0.7)_100%)]"
      />
    </div>
  );
};

export const BackgroundCanvas = memo(BackgroundCanvasComponent);
