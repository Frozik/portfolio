import { memo, useRef, useState } from 'react';
import { useAmbientCanvas } from '../../../../shared/hooks/useAmbientCanvas';
import { createControlsBackgroundAnimation } from './controls-background-animation';

export const ControlsBackground = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [animation] = useState(createControlsBackgroundAnimation);

  useAmbientCanvas(canvasRef, animation);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full opacity-0 transition-opacity"
    />
  );
});
