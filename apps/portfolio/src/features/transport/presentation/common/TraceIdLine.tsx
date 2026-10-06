import { Check, Copy, X } from 'lucide-react';
import { useEventCallback } from 'usehooks-ts';

import { useCopyToClipboard } from '../../../../shared/hooks/useCopyToClipboard';
import { transportT } from '../translations';

const ICON_SIZE_PX = 14;
const COPY_ICONS = { idle: Copy, copied: Check, failed: X } as const;

/** The id to quote when reporting a failure: the server logs the call under it. */
export const TraceIdLine = ({ traceId }: { readonly traceId: string }) => {
  const { status, copy } = useCopyToClipboard();
  const handleCopy = useEventCallback(() => {
    void copy(traceId);
  });
  const texts = transportT.failures.trace;
  const label = { idle: texts.copy, copied: texts.copied, failed: texts.copyFailed }[status];
  const Icon = COPY_ICONS[status];

  return (
    <span className="flex items-center gap-2">
      <span className="shrink-0">{texts.label}</span>
      <code className="min-w-0 truncate font-mono text-xs">{traceId}</code>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={label}
        title={label}
        className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-current/10"
      >
        <Icon size={ICON_SIZE_PX} aria-hidden="true" />
      </button>
    </span>
  );
};
