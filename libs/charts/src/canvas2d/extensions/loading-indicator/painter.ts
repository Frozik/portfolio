import { isNil } from 'lodash-es';

import type { IChartFrame } from '../../../core/frame/chart-frame';
import { cssOf, withAlpha } from '../../../core/series/color';
import { ownFrame } from '../../../core/stage/backend';
import type { IAxisRange } from '../../../core/viewport/axis-domain';
import { xToPixel } from '../../../core/viewport/plot-mapping';
import type { ICanvasPainter, TCanvasPainterFactory } from '../../painter';

const BAR_HEIGHT = 5;
const SHIMMER_CYCLE_MS = 1200;
const SHIMMER_HEIGHT_RATIO = 2;
const SHIMMER_MIDPOINT = 0.5;
/** How strongly a failed range is tinted, and how much stronger under the glow that travels across it. */
const WASH_ALPHA = 0.08;
const GLOW_ALPHA = 0.12;
const GLOW_CYCLE_MS = 2600;
/** The glow is this wide, as a share of the range it crosses. */
const GLOW_WIDTH_SHARE = 0.6;

interface IBar {
  readonly left: number;
  readonly width: number;
}

function barOf<TX>(frame: IChartFrame<TX>, range: IAxisRange<TX>): IBar | undefined {
  const left = Math.max(0, Math.floor(xToPixel(frame, range.start)));
  const right = Math.min(frame.size.width, Math.ceil(xToPixel(frame, range.end)));
  return right > left ? { left, width: right - left } : undefined;
}

/** The ranges as stretches of pixels, left to right; stretches that overlap or touch are one. */
function barsOf<TX>(frame: IChartFrame<TX>, ranges: readonly IAxisRange<TX>[]): readonly IBar[] {
  const ordered = ranges
    .flatMap(range => barOf(frame, range) ?? [])
    .sort((first, second) => first.left - second.left);
  const merged: IBar[] = [];
  for (const bar of ordered) {
    const last = merged.at(-1);
    if (isNil(last) || bar.left > last.left + last.width) {
      merged.push(bar);
    } else {
      const right = Math.max(last.left + last.width, bar.left + bar.width);
      merged[merged.length - 1] = { left: last.left, width: right - last.left };
    }
  }
  return merged;
}

/**
 * The plot over a range that failed to arrive, tinted faintly with the colour
 * of failure; a soft glow travels across it, so it reads as something still
 * being tried rather than as an empty chart.
 */
function washFailed<TX>(
  context: CanvasRenderingContext2D,
  frame: IChartFrame<TX>,
  failed: readonly IBar[],
  now: number
): void {
  const { plot, theme } = frame;
  const phase = (now % GLOW_CYCLE_MS) / GLOW_CYCLE_MS;
  for (const bar of failed) {
    const left = Math.max(plot.left, bar.left);
    const width = Math.min(plot.right, bar.left + bar.width) - left;
    if (width <= 0) {
      continue;
    }
    context.fillStyle = cssOf(withAlpha(theme.loading.failed, WASH_ALPHA));
    context.fillRect(left, plot.top, width, plot.height);

    const glowWidth = width * GLOW_WIDTH_SHARE;
    const glowLeft = left - glowWidth + phase * (width + glowWidth);
    const glow = context.createLinearGradient(glowLeft, 0, glowLeft + glowWidth, 0);
    glow.addColorStop(0, cssOf(withAlpha(theme.loading.failed, 0)));
    glow.addColorStop(SHIMMER_MIDPOINT, cssOf(withAlpha(theme.loading.failed, GLOW_ALPHA)));
    glow.addColorStop(1, cssOf(withAlpha(theme.loading.failed, 0)));
    context.fillStyle = glow;
    context.fillRect(left, plot.top, width, plot.height);
  }
}

/**
 * A bar along the bottom edge under every range of X still on its way,
 * shimmering, and a still one under every range that failed to arrive, with
 * the plot above it washed in the same colour.
 */
export function loadingIndicatorPainter<TX>(): TCanvasPainterFactory {
  return (): ICanvasPainter => {
    let painted: IChartFrame<unknown> | undefined;
    return {
      isStale(frame): boolean {
        const stale = frame !== painted || frame.loading.length > 0 || frame.failed.length > 0;
        painted = frame;
        return stale;
      },
      paint(context, unknownFrame, now): void {
        const frame = ownFrame<TX>(unknownFrame);
        const { theme, size } = frame;
        const barHeight = BAR_HEIGHT * Math.max(1, size.devicePixelRatio);
        const barTop = size.height - barHeight;

        const failed = barsOf(
          frame,
          frame.failed.map(failure => failure.range)
        );
        washFailed(context, frame, failed, now);
        context.fillStyle = cssOf(theme.loading.failed);
        for (const bar of failed) {
          context.fillRect(bar.left, barTop, bar.width, barHeight);
        }

        const loading = barsOf(frame, frame.loading);
        if (loading.length === 0) {
          return;
        }
        const shimmerHeight = barHeight * SHIMMER_HEIGHT_RATIO;
        const phase = (now % SHIMMER_CYCLE_MS) / SHIMMER_CYCLE_MS;
        const shimmerTop = barTop - shimmerHeight + phase * shimmerHeight;
        const gradient = context.createLinearGradient(0, shimmerTop, 0, shimmerTop + shimmerHeight);
        gradient.addColorStop(0, cssOf(theme.loading.light));
        gradient.addColorStop(SHIMMER_MIDPOINT, cssOf(theme.loading.dark));
        gradient.addColorStop(1, cssOf(theme.loading.light));

        context.save();
        context.beginPath();
        for (const bar of loading) {
          context.rect(bar.left, barTop, bar.width, barHeight);
        }
        context.clip();
        context.fillStyle = gradient;
        context.fillRect(0, shimmerTop, size.width, shimmerHeight);
        context.restore();
      },
    };
  };
}
