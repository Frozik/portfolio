import { useFunction } from '@frozik/components/hooks/useFunction';
import { useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '../lib/copyToClipboard';

const STATUS_RESET_DELAY_MS = 1800;

export type TCopyStatus = 'idle' | 'copied' | 'failed';

/**
 * Clipboard write with a transient `copied` / `failed` status that falls back
 * to `idle` after {@link STATUS_RESET_DELAY_MS}. The reset timer is cleared on
 * unmount and on every new copy, so a rapid second click restarts the window
 * instead of leaving an orphaned timeout behind.
 */
export function useCopyToClipboard(): {
  readonly status: TCopyStatus;
  readonly copy: (text: string) => Promise<boolean>;
} {
  const [status, setStatus] = useState<TCopyStatus>('idle');
  const resetTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimeout = useFunction(() => {
    if (resetTimeoutIdRef.current !== null) {
      clearTimeout(resetTimeoutIdRef.current);
      resetTimeoutIdRef.current = null;
    }
  });

  useEffect(() => clearResetTimeout, [clearResetTimeout]);

  const copy = useFunction(async (text: string): Promise<boolean> => {
    const succeeded = await copyToClipboard(text);
    clearResetTimeout();
    setStatus(succeeded ? 'copied' : 'failed');
    resetTimeoutIdRef.current = setTimeout(() => {
      resetTimeoutIdRef.current = null;
      setStatus('idle');
    }, STATUS_RESET_DELAY_MS);
    return succeeded;
  });

  return { status, copy };
}
