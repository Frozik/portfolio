import { memo, useRef, useState } from 'react';
import { useAmbientCanvas } from '../../shared/hooks/useAmbientCanvas';
import { createGameOfLifeAnimation } from './game-of-life-animation';

const GameOfLifeBackgroundComponent = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [animation] = useState(createGameOfLifeAnimation);

  useAmbientCanvas(canvasRef, animation);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
};

export const GameOfLifeBackground = memo(GameOfLifeBackgroundComponent);
