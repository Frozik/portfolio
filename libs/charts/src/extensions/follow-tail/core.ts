import { isNil } from 'lodash-es';

import { ACTIVE_FPS } from '../../core/frame/frame-demand';
import type { IChartExtension } from '../../core/kernel/extension';
import { spanOf } from '../../core/viewport/axis-domain';

/** How far short of the last element, as a share of the visible span, the right edge may stop and still count as at it. */
const AT_TAIL_SHARE = 0.02;
const DEFAULT_GLIDE_MS = 400;
const HALF = 0.5;

export interface IFollowTailOptions {
  /** The room `resume` leaves to the right of the last element, as a share of the visible span; none by default. */
  readonly headroom?: number;
  /** How long the view takes to catch up with a new element, easing in and out, milliseconds; nought moves it at once. */
  readonly glideMs?: number;
}

/** A catching-up in progress: how far the view has to go in all, and how far it has gone. */
interface IGlide {
  readonly startedAt: number;
  readonly total: number;
  travelled: number;
}

function easeInOut(progress: number): number {
  return progress < HALF ? 2 * progress * progress : 1 - (2 - 2 * progress) ** 2 / 2;
}

export interface IFollowTailSlice {
  /** The right edge is kept at the last element as new data arrives. */
  readonly isFollowing: boolean;
  /** Back to the end of the data, with the headroom to its right, and following again. */
  resume(): void;
}

/**
 * Moves the view along with the last element while new data comes in, keeping
 * whatever room there was to its right; it eases to each new element rather
 * than jumping. Following stops when the user leaves
 * the end for history and comes back by itself once the last element is in
 * view again, or on `resume` (§7.1).
 */
export function followTail<TX>(
  options: IFollowTailOptions = {}
): IChartExtension<TX, 'followTail', IFollowTailSlice> {
  const headroom = options.headroom ?? 0;
  const glideMs = options.glideMs ?? DEFAULT_GLIDE_MS;

  return {
    id: 'followTail',
    create(kernel) {
      const { domain, frames } = kernel;
      const { x: viewport } = kernel.viewport;
      let knownEnd: TX | undefined;
      let following = false;
      let glide: IGlide | undefined;

      const distanceLeft = (): number => (isNil(glide) ? 0 : glide.total - glide.travelled);

      /** The right edge is at the last element or beyond it — or on its way there: the newest data is in view. */
      const isAtTail = (end: TX): boolean => {
        const tolerance = spanOf(domain, viewport.target) * AT_TAIL_SHARE;
        return domain.diff(viewport.target.end, end) + distanceLeft() >= -tolerance;
      };

      const advance = (now: number): void => {
        if (isNil(glide)) {
          return;
        }
        const progress = glideMs <= 0 ? 1 : Math.min(1, (now - glide.startedAt) / glideMs);
        // What the viewport really moved, whole axis units and all, so the last step lands exactly.
        glide.travelled += viewport.shift(glide.total * easeInOut(progress) - glide.travelled);
        if (progress >= 1) {
          glide = undefined;
        } else {
          frames.raise(ACTIVE_FPS);
        }
      };

      return {
        slice: {
          get isFollowing(): boolean {
            return following;
          },
          resume(): void {
            const { end } = kernel.dataExtent;
            if (!isNil(end)) {
              const room = spanOf(domain, viewport.current) * headroom;
              viewport.shift(domain.diff(end, viewport.current.end) + room);
              following = true;
            }
          },
        },
        tick(now): void {
          const { end } = kernel.dataExtent;
          if (isNil(end)) {
            return;
          }
          following = isAtTail(knownEnd ?? end);
          if (!following) {
            glide = undefined;
          } else if (!isNil(knownEnd) && domain.compare(end, knownEnd) > 0) {
            // A new element mid-glide: the glide starts over from here with what was left of it added.
            glide = {
              startedAt: now,
              total: distanceLeft() + domain.diff(end, knownEnd),
              travelled: 0,
            };
          }
          knownEnd = end;
          advance(now);
        },
      };
    },
  };
}
