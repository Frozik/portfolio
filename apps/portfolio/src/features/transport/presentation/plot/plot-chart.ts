import { axes } from '@frozik/charts/canvas2d/extensions/axes/axes';
import { crosshair } from '@frozik/charts/canvas2d/extensions/crosshair/crosshair';
import { createChart } from '@frozik/charts/core/create-chart';
import { rgba } from '@frozik/charts/core/series/color';
import { series } from '@frozik/charts/core/series/series';
import { numberDomain } from '@frozik/charts/core/viewport/number-domain';
import { snapshot } from '@frozik/charts/data/snapshot/snapshot';
import type { ISnapshotSource } from '@frozik/charts/data/snapshot/source';
import { autoScaleY } from '@frozik/charts/extensions/auto-scale-y/core';
import { panZoom } from '@frozik/charts/extensions/pan-zoom/core';
import { scaleZoom } from '@frozik/charts/extensions/scale-zoom/core';
import { smoothZoom } from '@frozik/charts/extensions/smooth-zoom/core';
import { ticks } from '@frozik/charts/extensions/ticks/core';
import { linearTicks } from '@frozik/charts/extensions/ticks/linear-ticks';
import { grid } from '@frozik/charts/universal/extensions/grid';
import { lineStyle } from '@frozik/charts/universal/marks/lineStyle';

import type { PlotView } from '../../domain/plot';

const CURVE_COLOR = rgba(0.2, 0.6, 1);
const CURVE_WIDTH = 2;
const X_LABEL_WIDTH = 56;

/** A live plot: it opens on the view's range and asks the source again as the view is panned and zoomed. */
export function createPlotChart(source: ISnapshotSource<number>, view: PlotView) {
  return createChart({
    id: 'plot',
    x: { domain: numberDomain, start: view.xMin, end: view.xMax },
    series: [
      series({
        id: 'curve',
        data: snapshot(source),
        style: lineStyle<number>({ color: CURVE_COLOR, size: CURVE_WIDTH }),
      }),
    ],
    extensions: [
      ticks({ x: linearTicks({ labelSizePx: X_LABEL_WIDTH }) }),
      grid<number>(),
      axes<number>(),
      crosshair<number>(),
      panZoom<number>(),
      scaleZoom<number>(),
      smoothZoom<number>(),
      autoScaleY<number>(),
    ],
  });
}
