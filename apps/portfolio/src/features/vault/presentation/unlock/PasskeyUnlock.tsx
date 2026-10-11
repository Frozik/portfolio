import type { TBytes } from '@frozik/vault/crypto/bytes';
import { isNil } from 'lodash-es';
import { useEffect, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { Button } from '../../../../shared/ui/Button';
import type { TPasskeyFailure } from '../../domain/ports/passkeys';
import { keysT } from '../translations/keys';

/**
 * D15 — "Unlock with a passkey", shown only for a vault that has one: its
 * credential ids come from the local copy's plaintext header, ahead of the
 * click, so the browser's prompt opens straight from it.
 */
export function PasskeyUnlock({
  load,
  unlock,
  wrongPasskey,
  unlocking,
  onTry,
}: {
  readonly load: () => Promise<readonly TBytes[]>;
  readonly unlock: (credentialIds: readonly TBytes[]) => Promise<TPasskeyFailure | null>;
  /** The last unlock was with a passkey whose slot is gone. */
  readonly wrongPasskey: boolean;
  readonly unlocking: boolean;
  readonly onTry: () => void;
}) {
  const t = keysT.passkeys;
  const [credentialIds, setCredentialIds] = useState<readonly TBytes[]>([]);
  const [failure, setFailure] = useState<TPasskeyFailure | null>(null);
  useEffect(() => {
    void load().then(setCredentialIds);
  }, [load]);

  const click = useEventCallback(() => {
    setFailure(null);
    onTry();
    void unlock(credentialIds).then(setFailure);
  });

  if (credentialIds.length === 0) {
    return null;
  }
  const error = isNil(failure) ? (wrongPasskey ? t.wrongPasskey : null) : t.failures[failure];
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" className="self-start" disabled={unlocking} onClick={click}>
        {unlocking ? t.unlocking : t.unlock}
      </Button>
      {!isNil(error) && <span className="text-[12px] text-error">{error}</span>}
    </div>
  );
}
