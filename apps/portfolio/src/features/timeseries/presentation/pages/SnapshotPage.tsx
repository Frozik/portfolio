import type { ChartModel } from '@frozik/charts/core/chart-model';
import { useChart } from '@frozik/charts/react/useChart';
import { memo } from 'react';

import { createDepthChart } from '../../application/charts/depth-chart';
import { DemoStage } from '../components/DemoStage';
import { ExpandableChart } from '../components/ExpandableChart';
import { useTimeseriesAgentTools } from '../components/useTimeseriesAgentTools';

const NO_TIME_CHARTS: readonly ChartModel<bigint>[] = [];

export const SnapshotPage = memo(() => {
  const chart = useChart(createDepthChart);
  const charts = useChart(() => [chart]);
  useTimeseriesAgentTools(NO_TIME_CHARTS, charts);

  return (
    <DemoStage>
      <ExpandableChart model={chart} className="h-full w-full" />
    </DemoStage>
  );
});
