import { useFrameTime } from '@frozik/components/hooks/useFrameTime';
import { memo, useEffect, useRef } from 'react';

import type { IFrameTicker } from '../hooks/useFrameTicker';

const FPS_SAMPLE_SCALE = 200;
const FPS_SAMPLE_ROUNDING = 5;
const MILLISECONDS_PER_SECOND = 1000;
// Exponential smoothing weight for the newest sample. Matches the perceived
// stability of the previous dedicated rAF loop without the extra loop.
const FPS_SMOOTHING_FACTOR = 0.1;

const FrameTickerDriverComponent = ({
  ticker,
  paused,
}: {
  readonly ticker: IFrameTicker;
  readonly paused: boolean;
}) => {
  const { deltaTime } = useFrameTime(paused);

  const smoothedDeltaTimeRef = useRef(MILLISECONDS_PER_SECOND / FPS_SAMPLE_SCALE);

  useEffect(() => {
    if (paused || deltaTime <= 0) {
      return;
    }

    // Derive FPS from the main loop's deltaTime instead of running a second
    // requestAnimationFrame loop. Smoothing keeps the readout stable across
    // jittery frames, preserving the quantized value the dedicated loop showed.
    const smoothedDeltaTime =
      smoothedDeltaTimeRef.current +
      (deltaTime - smoothedDeltaTimeRef.current) * FPS_SMOOTHING_FACTOR;
    smoothedDeltaTimeRef.current = smoothedDeltaTime;

    ticker.setFps(Math.round(FPS_SAMPLE_SCALE / smoothedDeltaTime) * FPS_SAMPLE_ROUNDING);
  }, [deltaTime, paused, ticker]);

  useEffect(() => {
    void ticker.update(deltaTime);
  }, [deltaTime, ticker]);

  return null;
};

export const FrameTickerDriver = memo(FrameTickerDriverComponent);
