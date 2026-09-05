import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import { FrameTicker } from '../domain/FrameTicker';
import {
  INITIAL_FRAME_DELTA,
  quantizedFps,
  smoothFrameDelta,
  startFrameLoop,
} from '../domain/frame-loop';
import { Playground } from '../domain/Playground';
import { DEFAULT_GRAVITY } from '../domain/physics/world-gravity';
import type { IFrameScheduler } from '../domain/ports/frame-scheduler';
import type { TSubstepPolicy } from '../domain/simulation-speed';
import type { IPoint, IRenderer } from '../domain/types';

/**
 * One playground with its clock: drives the ticker from the host's frame loop
 * while running, and owns the pause and gravity the panel controls.
 */
export class PlaygroundSession {
  gravity = DEFAULT_GRAVITY;
  paused = true;

  readonly playground: Playground;

  private readonly ticker: FrameTicker;
  private stopFrameLoop: VoidFunction | undefined;
  private smoothedFrameDelta = INITIAL_FRAME_DELTA;

  constructor(
    private readonly frames: IFrameScheduler,
    substeps: TSubstepPolicy
  ) {
    this.ticker = new FrameTicker(substeps);
    this.playground = new Playground(this.ticker, frames);

    makeAutoObservable<
      PlaygroundSession,
      'frames' | 'ticker' | 'stopFrameLoop' | 'smoothedFrameDelta'
    >(
      this,
      {
        playground: false,
        frames: false,
        ticker: false,
        stopFrameLoop: false,
        smoothedFrameDelta: false,
      },
      { autoBind: true }
    );
  }

  setGravity(gravity: number): void {
    this.gravity = gravity;
    this.playground.setGravity(gravity);
  }

  setPaused(paused: boolean): void {
    if (paused === this.paused) {
      return;
    }
    this.paused = paused;

    if (paused) {
      this.stopFrameLoop?.();
      this.stopFrameLoop = undefined;
    } else {
      this.stopFrameLoop = startFrameLoop(this.frames, this.advanceFrame);
    }
  }

  togglePaused(): void {
    this.setPaused(!this.paused);
  }

  setPointerForce(pointerForce: IPoint | undefined): void {
    this.playground.setPointerForce(pointerForce);
  }

  attachRenderer(renderer: IRenderer | undefined): void {
    this.playground.setRenderer(renderer);
  }

  dispose(): void {
    this.setPaused(true);
    this.ticker.dispose();
    this.playground.destroy();
  }

  private advanceFrame(deltaTime: DOMHighResTimeStamp): void {
    if (deltaTime <= 0 || isNil(this.stopFrameLoop)) {
      return;
    }

    this.smoothedFrameDelta = smoothFrameDelta(this.smoothedFrameDelta, deltaTime);
    this.ticker.reportFps(quantizedFps(this.smoothedFrameDelta));
    void this.ticker.update(deltaTime);
  }
}
