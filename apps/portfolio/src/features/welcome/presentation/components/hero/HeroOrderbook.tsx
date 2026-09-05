import { memo, useRef, useState } from 'react';
import { useAmbientCanvas } from '../../../../../shared/hooks/useAmbientCanvas';
import { createHeroOrderbookAnimation } from './hero-orderbook-animation';

/** Enough density for the 10 px tape text to stay crisp; the heatmap cells need none. */
const MAX_DPR = 1.5;
/** The book scrolls one column every 220 ms — 30 fps is already smooth for it. */
const TARGET_FPS = 30;

export const HeroOrderbook = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [animation] = useState(createHeroOrderbookAnimation);

  useAmbientCanvas(canvasRef, { ...animation, maxDpr: MAX_DPR, targetFps: TARGET_FPS });

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-55 [mask-image:linear-gradient(180deg,transparent_0%,#000_25%,#000_75%,transparent_100%)]"
    />
  );
});
