import { observer } from 'mobx-react-lite';

import type { EchoProgress } from '../../application/EchoModel';
import { bytesPerSecond } from '../../domain/echo';
import { formatBytes, formatRate } from '../common/format';
import { transportT } from '../translations';

const PERCENT = 100;

function ProgressBar({
  label,
  value,
  total,
}: {
  readonly label: string;
  readonly value: number;
  readonly total: number;
}) {
  const share = total === 0 ? 0 : Math.min(1, value / total);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between font-mono text-xs text-landing-fg-dim">
        <span>{label}</span>
        <span>
          {formatBytes(value)} / {formatBytes(total)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
        <div
          className="h-full bg-brand-500 transition-[width]"
          style={{ width: `${share * PERCENT}%` }}
        />
      </div>
    </div>
  );
}

export const EchoProgressView = observer(
  ({ progress, size }: { readonly progress: EchoProgress; readonly size: number }) => (
    <div className="flex flex-col gap-3">
      <ProgressBar label={transportT.echo.sent} value={progress.sentBytes} total={size} />
      <ProgressBar label={transportT.echo.received} value={progress.receivedBytes} total={size} />
      <span className="font-mono text-xs text-landing-fg-faint">
        {transportT.echo.speed}:{' '}
        {formatRate(bytesPerSecond(progress.receivedBytes, progress.elapsedMs))}
      </span>
    </div>
  )
);
