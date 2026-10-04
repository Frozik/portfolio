import type { ISnapshotSource } from '@frozik/charts/data/snapshot/source';
import { Chart } from '@frozik/charts/react/Chart';
import { useChart } from '@frozik/charts/react/useChart';
import { memo } from 'react';

import type { PlotView } from '../../domain/plot';
import { transportT } from '../translations';
import { createPlotChart } from './plot-chart';

/** Built once per plotted function; panning and zooming fetch new windows through the source. */
const PlotChartComponent = ({
  source,
  view,
}: {
  readonly source: ISnapshotSource<number>;
  readonly view: PlotView;
}) => {
  const chart = useChart(() => createPlotChart(source, view));
  return <Chart model={chart} className="h-80 w-full" aria-label={transportT.plot.chartLabel} />;
};

export const PlotChart = memo(PlotChartComponent);
