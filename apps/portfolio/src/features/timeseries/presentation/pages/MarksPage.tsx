import { useChart } from '@frozik/charts/react/useChart';
import { range } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { createMarksChart, MARKS_CHART_COUNT } from '../../application/charts/marks-charts';
import { useTimeseriesDemoStore } from '../../application/useTimeseriesDemoStore';
import { DemoStage } from '../components/DemoStage';
import { ExpandableChart } from '../components/ExpandableChart';
import { useDebugBlocks } from '../components/useDebugBlocks';
import { useTimeseriesAgentTools } from '../components/useTimeseriesAgentTools';

export const MarksPage = observer(() => {
  const store = useTimeseriesDemoStore();
  const charts = useChart(() => range(MARKS_CHART_COUNT).map(createMarksChart));
  useTimeseriesAgentTools(charts);
  useDebugBlocks(charts, store.debug);

  return (
    <DemoStage>
      <div className="grid h-full w-full grid-cols-2 grid-rows-2">
        {charts.map(chart => (
          <ExpandableChart key={chart.id} model={chart} className="h-full w-full" />
        ))}
      </div>
    </DemoStage>
  );
});
