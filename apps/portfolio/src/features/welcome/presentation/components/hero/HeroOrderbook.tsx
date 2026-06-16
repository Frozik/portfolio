import { memo, useRef, useState } from 'react';
import { useAmbientCanvas } from '../../../../../shared/hooks/useAmbientCanvas';
import { createHeroOrderbookAnimation } from './hero-orderbook-animation';

export const HeroOrderbook = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [animation] = useState(createHeroOrderbookAnimation);

  useAmbientCanvas(canvasRef, animation);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-55 [mask-image:linear-gradient(180deg,transparent_0%,#000_25%,#000_75%,transparent_100%)]"
    />
  );
});
