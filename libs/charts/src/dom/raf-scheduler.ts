import type { IFrameScheduler } from '../core/host/frame-scheduler';

/** Frames from the browser's own cadence. */
export const rafScheduler: IFrameScheduler = {
  request: callback => requestAnimationFrame(callback),
  cancel: handle => cancelAnimationFrame(handle),
};
