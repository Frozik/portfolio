import { useMemo } from 'react';

import type { ITicker } from '../../domain/types';

const MIN_FPS = 30;

export interface IFrameTicker extends ITicker {
  update(deltaTime: DOMHighResTimeStamp): Promise<void>;
  setFps(fps: number): void;
}

export function useFrameTicker(
  deltaTimeFn?: (
    deltaTime: DOMHighResTimeStamp,
    multiplier: number
  ) => DOMHighResTimeStamp | DOMHighResTimeStamp[]
): IFrameTicker {
  return useMemo<IFrameTicker>(() => {
    const subscriptions = new Set<(deltaTime: DOMHighResTimeStamp) => Promise<void> | void>();

    let updateInProgress = false;
    let currentMultiplier = 1;
    let fps = 0;

    return {
      subscribe(handler: (deltaTime: DOMHighResTimeStamp) => Promise<void> | void): VoidFunction {
        subscriptions.add(handler);

        return () => subscriptions.delete(handler);
      },
      async update(deltaTime: DOMHighResTimeStamp) {
        if (updateInProgress) {
          return;
        }

        if (fps < MIN_FPS) {
          currentMultiplier = Math.max(1, currentMultiplier - 1);
        } else if (fps >= MIN_FPS) {
          currentMultiplier++;
        }

        const newDeltaTime = deltaTimeFn?.(deltaTime, currentMultiplier) ?? deltaTime;

        updateInProgress = true;

        if (Array.isArray(newDeltaTime)) {
          for (const dt of newDeltaTime) {
            for (const handler of subscriptions) {
              await handler(dt);
            }
          }
        } else {
          for (const handler of subscriptions) {
            await handler(newDeltaTime);
          }
        }

        updateInProgress = false;
      },
      setFps(value: number): void {
        fps = value;
      },
      dispose(): void {
        subscriptions.clear();
      },
    };
  }, [deltaTimeFn]);
}
