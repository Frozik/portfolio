import { axes } from '@frozik/charts/canvas2d/extensions/axes/axes';
import { crosshair } from '@frozik/charts/canvas2d/extensions/crosshair/crosshair';
import { loadingIndicator } from '@frozik/charts/canvas2d/extensions/loading-indicator/loadingIndicator';
import { autoScaleY } from '@frozik/charts/extensions/auto-scale-y/core';
import { bounds } from '@frozik/charts/extensions/bounds/core';
import { panZoom } from '@frozik/charts/extensions/pan-zoom/core';
import { scaleZoom } from '@frozik/charts/extensions/scale-zoom/core';
import { smoothZoom } from '@frozik/charts/extensions/smooth-zoom/core';
import { ticks } from '@frozik/charts/extensions/ticks/core';
import { timeTicks } from '@frozik/charts/extensions/ticks/time-ticks';
import { debugBlocks } from '@frozik/charts/universal/extensions/debugBlocks';
import { grid } from '@frozik/charts/universal/extensions/grid';

import { MINUTE } from '../../domain/demo-time';

export interface ITimeExtensionsOptions {
  /** The shortest stretch of time a chart zooms in to. */
  readonly minRange?: bigint;
  /** The zone the labels of the time axis are written in; UTC by default. */
  readonly timeZone?: string;
  /** Room left above and below the data, as a share of its height; the default of the autoscale when not given. */
  readonly valuePadding?: number;
}

/** What every chart over time in the demo is made of: axes, grid, crosshair, gestures, autoscale. */
export function timeExtensions({
  minRange = MINUTE,
  timeZone,
  valuePadding,
}: ITimeExtensionsOptions = {}) {
  return [
    ticks({ x: timeTicks({ timeZone }) }),
    grid<bigint>(),
    axes<bigint>(),
    crosshair<bigint>(),
    loadingIndicator<bigint>(),
    debugBlocks<bigint>(),
    panZoom<bigint>(),
    scaleZoom<bigint>(),
    smoothZoom<bigint>(),
    bounds<bigint>({ minRange: Number(minRange) }),
    autoScaleY<bigint>({ padding: valuePadding }),
  ] as const;
}
