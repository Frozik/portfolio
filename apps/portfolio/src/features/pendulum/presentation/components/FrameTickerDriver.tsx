import { useFrameTime } from '@frozik/components';
import { memo, useEffect } from 'react';

import type { IFrameTicker } from '../hooks/useFrameTicker';

const FPS_SAMPLE_SCALE = 200;
const FPS_SAMPLE_ROUNDING = 5;

type FrameTickerDriverProps = {
  readonly ticker: IFrameTicker;
  readonly paused: boolean;
};

const FrameTickerDriverComponent = ({ ticker, paused }: FrameTickerDriverProps) => {
  const { deltaTime } = useFrameTime(paused);

  useEffect(() => {
    if (paused) {
      return;
    }

    let previousFrameTime = performance.now();

    let frameId = requestAnimationFrame(function loop() {
      const now = performance.now();
      ticker.setFps(Math.round(FPS_SAMPLE_SCALE / (now - previousFrameTime)) * FPS_SAMPLE_ROUNDING);
      previousFrameTime = now;
      frameId = requestAnimationFrame(loop);
    });

    return () => cancelAnimationFrame(frameId);
  }, [paused, ticker]);

  useEffect(() => {
    void ticker.update(deltaTime);
  }, [deltaTime, ticker]);

  return null;
};

export const FrameTickerDriver = memo(FrameTickerDriverComponent);
