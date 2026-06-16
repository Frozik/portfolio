import { memo, useRef, useState } from 'react';
import { useAmbientCanvas } from '../../../../shared/hooks/useAmbientCanvas';
import { createRetroBackgroundAnimation } from './retro-background-animation';

const DEFAULT_OPACITY = 0.5;

const RetroBackgroundComponent = ({ opacity = DEFAULT_OPACITY }: { readonly opacity?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animation] = useState(createRetroBackgroundAnimation);

  useAmbientCanvas(canvasRef, animation);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-dvh w-dvw print:hidden"
      // Opacity is a prop-driven numeric value; inline style is the
      // idiomatic way to apply it without generating infinite Tailwind
      // opacity arbitrary classes.
      style={{ opacity }}
    />
  );
};

export const RetroBackground = memo(RetroBackgroundComponent);
