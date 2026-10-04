import { ChartStageProvider } from '@frozik/charts/react/ChartStageProvider';
import { availableBackends } from '@frozik/charts/universal/backends';
import { observer } from 'mobx-react-lite';

import type { PlotModel } from '../../application/PlotModel';
import { Panel } from '../common/Panel';
import { transportT } from '../translations';
import { PlotForm } from './PlotForm';
import { PlotOutcome } from './PlotOutcome';

export const PlotPanel = observer(({ plot }: { readonly plot: PlotModel }) => (
  <Panel title={transportT.plot.title}>
    <PlotForm plot={plot} />
    <ChartStageProvider backends={availableBackends}>
      <PlotOutcome plot={plot} state={plot.state} />
    </ChartStageProvider>
  </Panel>
));
