import type { IChartSize, ISizeSource } from '../core/host/size-source';

/**
 * The device-pixel size of a chart, read from the CSS box of its element once
 * a frame; every consumer reuses the numbers of the frame instead of
 * re-reading `clientWidth`, which would force a layout flush each time.
 */
export function createSizeTracker(element: HTMLElement): ISizeSource {
  return {
    measure(): IChartSize {
      const devicePixelRatio = Math.max(1, window.devicePixelRatio);
      return {
        width: Math.floor(element.clientWidth * devicePixelRatio),
        height: Math.floor(element.clientHeight * devicePixelRatio),
        devicePixelRatio,
      };
    },
  };
}
