import { useEffect, useState } from 'react';

const INITIAL_FRAME_STATE = {
  frameTime: 0,
  deltaTime: 0,
};

export function useFrameTime(paused = false): {
  frameTime: DOMHighResTimeStamp;
  deltaTime: DOMHighResTimeStamp;
} {
  const [frameState, setFrameState] = useState<{
    frameTime: DOMHighResTimeStamp;
    deltaTime: DOMHighResTimeStamp;
  }>(INITIAL_FRAME_STATE);

  useEffect(() => {
    if (paused) {
      return;
    }

    let globalTime: DOMHighResTimeStamp = 0;

    let frameId: number = requestAnimationFrame((time: DOMHighResTimeStamp) => onFrame(time, true));

    async function onFrame(time: DOMHighResTimeStamp, firstTick = false) {
      if (!firstTick) {
        const deltaTime = time - globalTime;

        setFrameState(state => ({
          frameTime: state.frameTime + deltaTime,
          deltaTime,
        }));
      }

      globalTime = time;

      frameId = requestAnimationFrame(onFrame);
    }

    return () => cancelAnimationFrame(frameId);
  }, [paused]);

  return frameState;
}
