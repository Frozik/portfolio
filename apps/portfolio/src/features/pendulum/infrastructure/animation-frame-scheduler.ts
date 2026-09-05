import type { IFrameScheduler } from '../domain/ports/frame-scheduler';

export const animationFrameScheduler: IFrameScheduler = {
  requestFrame(callback) {
    const frameId = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(frameId);
  },
};
