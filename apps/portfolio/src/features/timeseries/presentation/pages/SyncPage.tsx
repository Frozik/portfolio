import { useChart } from '@frozik/charts/react/useChart';
import { observer } from 'mobx-react-lite';

import { createSyncedCharts } from '../../application/charts/synced-charts';
import { useTimeseriesDemoStore } from '../../application/useTimeseriesDemoStore';
import { DemoStage } from '../components/DemoStage';
import { ExpandableChart } from '../components/ExpandableChart';
import { useDebugBlocks } from '../components/useDebugBlocks';

export const SyncPage = observer(() => {
  const store = useTimeseriesDemoStore();
  const charts = useChart(() => createSyncedCharts(store));
  useDebugBlocks(charts, store.debug);

  return (
    <DemoStage>
      <div className="grid h-full w-full grid-rows-2">
        {charts.map(chart => (
          <ExpandableChart key={chart.id} model={chart} className="h-full w-full" />
        ))}
      </div>
    </DemoStage>
  );
});
