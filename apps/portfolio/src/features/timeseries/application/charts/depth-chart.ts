import { axes } from '@frozik/charts/canvas2d/extensions/axes/axes';
import { crosshair } from '@frozik/charts/canvas2d/extensions/crosshair/crosshair';
import { createChart } from '@frozik/charts/core/create-chart';
import { series } from '@frozik/charts/core/series/series';
import { numberDomain } from '@frozik/charts/core/viewport/number-domain';
import { snapshot } from '@frozik/charts/data/snapshot/snapshot';
import { snapshotOf } from '@frozik/charts/data/snapshot/snapshot-of';
import { autoScaleY } from '@frozik/charts/extensions/auto-scale-y/core';
import { bounds } from '@frozik/charts/extensions/bounds/core';
import { panZoom } from '@frozik/charts/extensions/pan-zoom/core';
import { scaleZoom } from '@frozik/charts/extensions/scale-zoom/core';
import { smoothZoom } from '@frozik/charts/extensions/smooth-zoom/core';
import { ticks } from '@frozik/charts/extensions/ticks/core';
import { linearTicks } from '@frozik/charts/extensions/ticks/linear-ticks';
import { cuts } from '@frozik/charts/universal/extensions/cuts';
import { grid } from '@frozik/charts/universal/extensions/grid';
import { areaStyle } from '@frozik/charts/universal/marks/areaStyle';

import { DEPTH_EXTENT, depthCurve } from '../../domain/depth-curve';
import { AREA_BLUE, LIGHT_BLUE } from '../palette';

const UPDATE_INTERVAL_MS = 400;
const PHASE_STEP = 0.08;
const MIN_RANGE = 10;
const X_LABEL_WIDTH = 50;
/** A stretch of the axis the chart skips over: the curve is drawn as if it were not there. */
const SKIPPED = { from: DEPTH_EXTENT * 0.45, to: DEPTH_EXTENT * 0.6 };

/**
 * An ordinary chart: a numeric X axis and a set of points the application
 * holds and replaces as a whole a few times a second. The feed runs only
 * while the chart is on a stage. A stretch of the axis is cut out, so the
 * two sides of it stand next to each other with a dashed strip between.
 */
export function createDepthChart() {
  let phase = 0;
  const feed = snapshotOf<number>(
    () => ({ shape: 'point', points: depthCurve(phase) }),
    onChange => {
      const timer = setInterval(() => {
        phase += PHASE_STEP;
        onChange();
      }, UPDATE_INTERVAL_MS);
      return () => clearInterval(timer);
    }
  );
  return createChart({
    id: 'depth',
    x: { domain: numberDomain, cuts: [SKIPPED], start: 0, end: DEPTH_EXTENT },
    y: { min: 0, max: 60 },
    series: [
      series({
        id: 'depth',
        data: snapshot(feed),
        style: areaStyle({ color: AREA_BLUE, line: { color: LIGHT_BLUE, size: 2 } }),
      }),
    ],
    extensions: [
      ticks({ x: linearTicks({ labelSizePx: X_LABEL_WIDTH }) }),
      grid<number>(),
      cuts<number>(),
      axes<number>(),
      crosshair<number>(),
      panZoom<number>(),
      scaleZoom<number>(),
      smoothZoom<number>(),
      bounds<number>({ min: 0, max: DEPTH_EXTENT, minRange: MIN_RANGE }),
      autoScaleY<number>(),
    ],
  });
}
