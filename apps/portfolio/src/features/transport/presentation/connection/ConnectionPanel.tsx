import { cn } from '@frozik/components/components/cn';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { observer } from 'mobx-react-lite';

import { RadioGroup } from '../../../../shared/ui/RadioGroup';
import type { ConnectionModel } from '../../application/ConnectionModel';
import type { ConnectionState, TransportMode, WireFormat } from '../../domain/connection';
import { Panel } from '../common/Panel';
import { transportT } from '../translations';

const MODES: readonly TransportMode[] = ['auto', 'http3', 'websocket'];
const WIRE_FORMATS: readonly WireFormat[] = ['binary', 'json'];

function describe(state: ConnectionState): string {
  const texts = transportT.connection.states;
  switch (state.kind) {
    case 'idle':
      return texts.idle;
    case 'connecting':
      return texts.connecting;
    case 'open':
      return texts.open(transportT.connection.protocols[state.protocol]);
    case 'failed':
      return texts.failed(state.reason);
    default:
      return assertNever(state);
  }
}

const DOT_BY_STATE: Readonly<Record<ConnectionState['kind'], string>> = {
  idle: 'bg-landing-fg-faint',
  connecting: 'bg-warning animate-pulse',
  open: 'bg-success',
  failed: 'bg-error',
};

export const ConnectionPanel = observer(
  ({ connection }: { readonly connection: ConnectionModel }) => (
    <Panel title={transportT.connection.title}>
      <div className="flex items-center gap-3">
        <span
          className={cn('size-2.5 shrink-0 rounded-full', DOT_BY_STATE[connection.state.kind])}
        />
        <span className="text-sm text-landing-fg">{describe(connection.state)}</span>
      </div>
      <RadioGroup
        optionType="button"
        options={MODES.map(mode => ({ value: mode, label: transportT.connection.modes[mode] }))}
        value={connection.mode}
        onChange={connection.setMode}
      />
      <p className="text-xs text-landing-fg-dim">{transportT.connection.modeHint}</p>
      <RadioGroup
        optionType="button"
        options={WIRE_FORMATS.map(format => ({
          value: format,
          label: transportT.connection.wireFormats[format],
        }))}
        value={connection.wireFormat}
        onChange={connection.setWireFormat}
      />
      <p className="text-xs text-landing-fg-dim">{transportT.connection.wireFormatHint}</p>
    </Panel>
  )
);
