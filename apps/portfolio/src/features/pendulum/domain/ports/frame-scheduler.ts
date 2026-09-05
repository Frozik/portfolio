/**
 * Port over the host's frame clock (`requestAnimationFrame` in the browser),
 * keeping the simulation loop and render debounce free of browser globals.
 */
export interface IFrameScheduler {
  /** Runs `callback` on the next frame; the returned function cancels it. */
  requestFrame(callback: (time: DOMHighResTimeStamp) => void): VoidFunction;
}
