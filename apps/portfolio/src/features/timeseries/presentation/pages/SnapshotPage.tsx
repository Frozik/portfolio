import { useChart } from '@frozik/charts/react/useChart';
import { memo } from 'react';

import { createDepthChart } from '../../application/charts/depth-chart';
import { DemoStage } from '../components/DemoStage';
import { ExpandableChart } from '../components/ExpandableChart';

export const SnapshotPage = memo(() => {
  const chart = useChart(createDepthChart);

  return (
    <DemoStage>
      <ExpandableChart model={chart} className="h-full w-full" />
    </DemoStage>
  );
});
