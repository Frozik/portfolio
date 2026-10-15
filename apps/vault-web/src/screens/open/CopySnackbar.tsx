import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import type { Temporal } from 'temporal-polyfill';
import { useInterval } from 'usehooks-ts';

import { Button } from '@frozik/components/ui/Button';
import type { ClipboardGuard } from '@frozik/vault-app/exposure/application/ClipboardGuard';
import { vaultT } from '@frozik/vault-react/texts/vault';

const SECOND_MS = 1000;

/**
 * "Password copied · clears in 30 s" with a live countdown and "Clear now",
 * while the copy waits to be cleared; the countdown is announced politely.
 */
export const CopySnackbar = observer(
  ({
    clipboard,
    label,
    now,
  }: {
    readonly clipboard: ClipboardGuard;
    /** What was copied, by its field's label. */
    readonly label: string | null;
    /** The session's clock, the one the clearing runs on. */
    readonly now: () => Temporal.Instant;
  }) => {
    const [, setTick] = useState(0);
    const { clearsAt } = clipboard;
    useInterval(() => setTick(tick => tick + 1), isNil(clearsAt) ? null : SECOND_MS);
    if (isNil(clearsAt) || isNil(label)) {
      return null;
    }
    const seconds = Math.max(0, Math.ceil((clearsAt - now().epochMilliseconds) / SECOND_MS));
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="copy-snackbar"
        className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-lg items-center gap-3 rounded-lg bg-fg px-4 py-3 text-[14px] text-bg shadow-lg"
      >
        <span className="flex-1">{vaultT.phone.copied(label, seconds)}</span>
        <Button type="button" variant="ghost" className="text-bg" onClick={clipboard.flush}>
          {vaultT.phone.clearNow}
        </Button>
      </div>
    );
  }
);
