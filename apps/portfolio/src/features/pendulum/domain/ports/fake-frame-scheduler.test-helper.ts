import type { IFrameScheduler } from './frame-scheduler';

export interface IFakeFrameScheduler extends IFrameScheduler {
  /** Runs every callback queued so far with the given frame time. */
  fire(time: DOMHighResTimeStamp): void;
  pendingCount(): number;
}

export function createFakeFrameScheduler(): IFakeFrameScheduler {
  let pending: ((time: DOMHighResTimeStamp) => void)[] = [];

  return {
    requestFrame(callback) {
      pending.push(callback);
      return () => {
        pending = pending.filter(queued => queued !== callback);
      };
    },
    fire(time) {
      const callbacks = pending;
      pending = [];
      for (const callback of callbacks) {
        callback(time);
      }
    },
    pendingCount() {
      return pending.length;
    },
  };
}
