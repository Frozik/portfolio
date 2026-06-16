import { memo, useRef, useState } from 'react';
import { useAmbientCanvas } from '../../../../shared/hooks/useAmbientCanvas';
import { createConfBackgroundAnimation } from './conf-background-animation';

export const ConfBackground = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [animation] = useState(createConfBackgroundAnimation);

  useAmbientCanvas(canvasRef, animation);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full opacity-0 transition-opacity"
    />
  );
});
