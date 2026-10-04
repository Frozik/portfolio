import { useChart } from '@frozik/charts/react/useChart';
import { observer } from 'mobx-react-lite';

import { createWorkspaceChart } from '../../application/charts/workspace-chart';
import { useTimeseriesDemoStore } from '../../application/useTimeseriesDemoStore';
import { DemoStage } from '../components/DemoStage';
import { ExpandableChart } from '../components/ExpandableChart';
import { useDebugBlocks } from '../components/useDebugBlocks';
import { useTimeseriesAgentTools } from '../components/useTimeseriesAgentTools';

export const WorkspacePage = observer(() => {
  const store = useTimeseriesDemoStore();
  const chart = useChart(() => createWorkspaceChart(store));
  const charts = useChart(() => [chart]);
  useDebugBlocks(charts, store.debug);
  useTimeseriesAgentTools(charts);

  return (
    <DemoStage>
      <ExpandableChart model={chart} className="h-full w-full" />
    </DemoStage>
  );
});
