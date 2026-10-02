import { isNil } from 'lodash-es';
import { ACTIVE_FPS } from '../../core/frame/frame-demand';

import type { IChartExtension } from '../../core/kernel/extension';
import type { IAxisRange } from '../../core/viewport/axis-domain';
import { spanOf } from '../../core/viewport/axis-domain';

const DEFAULT_SPEED = 0.18;
/** Closer to the target than this share of the visible span, the drawn range snaps to it. */
const SNAP_SHARE = 0.005;

export interface ISmoothZoomOptions {
  /** The share of the remaining way covered each frame, 0…1. */
  readonly speed?: number;
}

/**
 * Eases what is drawn towards the target instead of jumping, and on a resize
 * keeps the time per pixel for a moment, so the chart springs to its new
 * width instead of snapping (§7.1).
 */
export function smoothZoom<TX>(
  options: ISmoothZoomOptions = {}
): IChartExtension<TX, 'smoothZoom', undefined> {
  const speed = options.speed ?? DEFAULT_SPEED;

  return {
    id: 'smoothZoom',
    create(kernel) {
      const { domain, viewport, frames } = kernel;

      const animate = (current: IAxisRange<TX>, target: IAxisRange<TX>): IAxisRange<TX> => {
        const startGap = domain.diff(target.start, current.start);
        const endGap = domain.diff(target.end, current.end);
        const snap = spanOf(domain, current) * SNAP_SHARE;
        if (Math.abs(startGap) <= snap && Math.abs(endGap) <= snap) {
          return target;
        }
        frames.raise(ACTIVE_FPS);
        return {
          start: domain.add(current.start, startGap * speed),
          end: domain.add(current.end, endGap * speed),
        };
      };

      const unsubscribe = kernel.events.on('size.changed', ({ previous, next }) => {
        if (isNil(previous) || previous.width === 0 || previous.width === next.width) {
          return;
        }
        const { current } = viewport;
        const span = spanOf(domain, current);
        const widened = span * (next.width / previous.width);
        const center = domain.add(current.start, span / 2);
        viewport.setCurrent({
          start: domain.add(center, -widened / 2),
          end: domain.add(center, widened / 2),
        });
        frames.raise(ACTIVE_FPS);
      });

      return { slice: undefined, animate, dispose: unsubscribe };
    },
  };
}
