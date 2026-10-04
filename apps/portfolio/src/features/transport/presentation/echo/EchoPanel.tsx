import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { Button } from '../../../../shared/ui/Button';
import type { EchoModel } from '../../application/EchoModel';
import { formatBytes, formatRate } from '../common/format';
import { Panel } from '../common/Panel';
import { transportT } from '../translations';
import { EchoOutcome } from './EchoOutcome';
import { EchoResults } from './EchoResults';

export const EchoPanel = observer(({ echo }: { readonly echo: EchoModel }) => {
  const handleFile = useEventCallback((event: ChangeEvent<HTMLInputElement>) =>
    echo.select(event.target.files?.[0])
  );
  const handleStart = useEventCallback(() => void echo.start());
  const limits = echo.limits;

  return (
    <Panel title={transportT.echo.title}>
      <p className="text-sm text-landing-fg-dim">{transportT.echo.description}</p>
      {limits !== undefined && (
        <p className="font-mono text-xs text-landing-fg-faint">
          {transportT.echo.limits(
            formatBytes(limits.maxFileBytes),
            formatRate(limits.rateBytesPerSecond)
          )}
        </p>
      )}
      <input
        type="file"
        aria-label={transportT.echo.pick}
        disabled={echo.isBusy}
        onChange={handleFile}
        className="text-sm text-landing-fg-dim file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-elevated file:px-3 file:py-1.5 file:text-text"
      />
      <div className="flex items-center gap-3">
        <Button disabled={!echo.canStart} onClick={handleStart}>
          {transportT.echo.start}
        </Button>
        {echo.state.kind === 'running' && (
          <Button variant="ghost" onClick={echo.cancel}>
            {transportT.echo.cancel}
          </Button>
        )}
      </div>
      <EchoOutcome state={echo.state} limit={limits?.maxFileBytes ?? 0} />
      <EchoResults echo={echo} />
    </Panel>
  );
});
