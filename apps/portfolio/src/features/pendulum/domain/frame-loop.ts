import { isNil } from 'lodash-es';

import type { IFrameScheduler } from './ports/frame-scheduler';

const MS_PER_SECOND = 1000;
const FPS_QUANTUM = 5;
// Exponential smoothing weight of the newest frame delta.
const FRAME_DELTA_SMOOTHING = 0.1;

export const INITIAL_FRAME_DELTA = MS_PER_SECOND / 60;

/** Runs `onFrame` with the elapsed time on every frame until the returned function is called. */
export function startFrameLoop(
  frames: IFrameScheduler,
  onFrame: (deltaTime: DOMHighResTimeStamp) => void
): VoidFunction {
  let previousTime: DOMHighResTimeStamp | undefined;

  const handleFrame = (time: DOMHighResTimeStamp): void => {
    if (!isNil(previousTime)) {
      onFrame(time - previousTime);
    }
    previousTime = time;
    cancel = frames.requestFrame(handleFrame);
  };

  let cancel = frames.requestFrame(handleFrame);

  return () => cancel();
}

export function smoothFrameDelta(
  previous: DOMHighResTimeStamp,
  sample: DOMHighResTimeStamp
): DOMHighResTimeStamp {
  return previous + (sample - previous) * FRAME_DELTA_SMOOTHING;
}

/** Frame rate rounded to the nearest 5 so the speed policy is not jittered by single frames. */
export function quantizedFps(frameDelta: DOMHighResTimeStamp): number {
  return Math.round(MS_PER_SECOND / frameDelta / FPS_QUANTUM) * FPS_QUANTUM;
}
