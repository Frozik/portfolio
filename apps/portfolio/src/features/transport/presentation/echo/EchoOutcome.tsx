import { assertNever } from '@frozik/utils/assert/assertNever';
import { observer } from 'mobx-react-lite';

import { Alert } from '../../../../shared/ui/Alert';
import type { EchoState } from '../../application/EchoModel';
import { CallFailureNotice } from '../common/CallFailureNotice';
import { formatBytes } from '../common/format';
import { transportT } from '../translations';
import { EchoProgressView } from './EchoProgressView';

/** What the current echo is doing, or why it is not. */
export const EchoOutcome = observer(
  ({ state, limit }: { readonly state: EchoState; readonly limit: number }) => {
    switch (state.kind) {
      case 'idle':
      case 'opening':
        return null;
      case 'too-large':
        return (
          <Alert
            type="warning"
            message={transportT.echo.tooLarge(formatBytes(state.size), formatBytes(limit))}
          />
        );
      case 'no-streaming-save':
        return <Alert type="warning" message={transportT.echo.noStreamingSave} />;
      case 'running':
        return (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-landing-fg-dim">
              {state.fileName} · {transportT.echo.strategy[state.strategy]}
            </span>
            <EchoProgressView progress={state.progress} size={state.size} />
          </div>
        );
      case 'cancelled':
        return <Alert type="info" message={transportT.echo.cancelled} />;
      case 'failed':
        return <CallFailureNotice failure={state.failure} />;
      default:
        return assertNever(state);
    }
  }
);
