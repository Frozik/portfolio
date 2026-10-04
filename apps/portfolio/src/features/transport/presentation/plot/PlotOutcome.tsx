import { assertNever } from '@frozik/utils/assert/assertNever';
import { observer } from 'mobx-react-lite';

import { Alert } from '../../../../shared/ui/Alert';
import type { LastSample, PlotModel, PlotState } from '../../application/PlotModel';
import { CallFailureNotice } from '../common/CallFailureNotice';
import { transportT } from '../translations';
import { ExpressionErrorMarker } from './ExpressionErrorMarker';
import { PlotChart } from './PlotChart';

const SampleInfo = observer(({ sample }: { readonly sample: LastSample | undefined }) => (
  <span className="font-mono text-xs text-landing-fg-faint">
    {sample === undefined
      ? transportT.plot.waiting
      : transportT.plot.lastSample(sample.points, sample.durationMs)}
  </span>
));

export const PlotOutcome = observer(
  ({ plot, state }: { readonly plot: PlotModel; readonly state: PlotState }) => {
    switch (state.kind) {
      case 'idle':
        return null;
      case 'invalid-input':
        return <Alert type="warning" message={transportT.plot.inputErrors[state.error]} />;
      case 'live':
        return (
          <div className="flex flex-col gap-2">
            <PlotChart key={state.id} source={state.source} view={state.view} />
            <SampleInfo sample={plot.lastSample} />
            <span className="text-xs text-landing-fg-faint">{transportT.plot.navigationHint}</span>
          </div>
        );
      case 'failed':
        return state.failure.kind === 'expression' ? (
          <ExpressionErrorMarker
            expression={state.view.expression}
            position={state.failure.position}
            reason={state.failure.reason}
          />
        ) : (
          <CallFailureNotice failure={state.failure} />
        );
      default:
        return assertNever(state);
    }
  }
);
