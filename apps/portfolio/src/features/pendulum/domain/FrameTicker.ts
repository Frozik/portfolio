import type { TSubstepPolicy } from './simulation-speed';
import { nextSpeedMultiplier } from './simulation-speed';
import type { ITicker } from './types';

type TTickHandler = (deltaTime: DOMHighResTimeStamp) => Promise<void> | void;

/**
 * Turns frame deltas into simulation substeps for its subscribers, adapting
 * the substep count to the reported frame rate. A frame arriving while the
 * previous one is still being simulated is skipped.
 */
export class FrameTicker implements ITicker {
  private readonly handlers = new Set<TTickHandler>();
  private updateInProgress = false;
  private multiplier = 1;
  private fps = 0;

  constructor(private readonly substeps: TSubstepPolicy) {}

  subscribe(handler: TTickHandler): VoidFunction {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  reportFps(fps: number): void {
    this.fps = fps;
  }

  async update(deltaTime: DOMHighResTimeStamp): Promise<void> {
    if (this.updateInProgress) {
      return;
    }

    this.multiplier = nextSpeedMultiplier(this.multiplier, this.fps);
    this.updateInProgress = true;

    try {
      for (const substep of this.substeps(deltaTime, this.multiplier)) {
        for (const handler of this.handlers) {
          await handler(substep);
        }
      }
    } finally {
      this.updateInProgress = false;
    }
  }

  dispose(): void {
    this.handlers.clear();
  }
}
