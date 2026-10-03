import { isNil } from 'lodash-es';
import { ACTIVE_FPS } from '../../core/frame/frame-demand';

import type { IChartExtension } from '../../core/kernel/extension';
import type { IAxisDomain, IAxisRange } from '../../core/viewport/axis-domain';
import { spanOf } from '../../core/viewport/axis-domain';

const DEFAULT_SPEED = 0.18;
/** Closer to the target than this share of the visible span, the drawn range snaps to it. */
const SNAP_SHARE = 0.005;

export interface ISmoothZoomOptions {
  /** The share of the remaining way covered each frame, 0…1. */
  readonly speed?: number;
}

/**
 * Eases what is drawn along every axis towards its target instead of jumping
 * — the X axis after a zoom, a value scale after a fit — and on a resize
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
      const { domain, frames } = kernel;
      const { x: viewport } = kernel.viewport;

      const animate = <T>(
        axis: IAxisDomain<T>,
        current: IAxisRange<T>,
        target: IAxisRange<T>
      ): IAxisRange<T> => {
        const startGap = axis.diff(target.start, current.start);
        const endGap = axis.diff(target.end, current.end);
        const snap = spanOf(axis, current) * SNAP_SHARE;
        if (Math.abs(startGap) <= snap && Math.abs(endGap) <= snap) {
          return target;
        }
        frames.raise(ACTIVE_FPS);
        return {
          start: axis.add(current.start, startGap * speed),
          end: axis.add(current.end, endGap * speed),
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
