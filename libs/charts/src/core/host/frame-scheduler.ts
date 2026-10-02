export interface IFrameScheduler {
  /** Asks for one frame; the callback gets the time in milliseconds. Returns a handle for `cancel`. */
  request(callback: (now: number) => void): number;
  cancel(handle: number): void;
}
