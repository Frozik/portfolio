import type { TBytes } from '@frozik/vault/crypto/bytes';
import { isNil } from 'lodash-es';
import { useEffect, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { Button } from '@frozik/components/ui/Button';
import type {
  IPasskeyCapabilities,
  TPasskeyFailure,
  TPlatformAuthenticator,
} from '@frozik/vault-app/keys/domain/ports/passkeys';
import { keysT } from '../texts/keys';

/**
 * "Unlock with a passkey", shown only for a vault that has one of this site
 * and a browser that can use it: the credential ids come from the local
 * copy's plaintext header ahead of the click, so the prompt opens straight
 * from it, named after the platform's authenticator.
 */
export function PasskeyUnlock({
  load,
  unlock,
  wrongPasskey,
  unlocking,
  onTry,
}: {
  readonly load: () => Promise<{
    readonly credentialIds: readonly TBytes[];
    readonly capabilities: IPasskeyCapabilities;
  }>;
  readonly unlock: (credentialIds: readonly TBytes[]) => Promise<TPasskeyFailure | null>;
  /** The last unlock was with a passkey whose slot is gone. */
  readonly wrongPasskey: boolean;
  readonly unlocking: boolean;
  readonly onTry: () => void;
}) {
  const t = keysT.passkeys;
  const [credentialIds, setCredentialIds] = useState<readonly TBytes[]>([]);
  const [platform, setPlatform] = useState<TPlatformAuthenticator>('passkey');
  const [failure, setFailure] = useState<TPasskeyFailure | null>(null);
  useEffect(() => {
    void load().then(loaded => {
      setCredentialIds(loaded.capabilities.prf ? loaded.credentialIds : []);
      setPlatform(loaded.capabilities.platform);
    });
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
      <Button
        type="button"
        className="self-start"
        data-testid="passkey-unlock"
        data-platform={platform}
        disabled={unlocking}
        onClick={click}
      >
        {unlocking ? t.unlocking : t.unlockWith[platform]}
      </Button>
      {!isNil(error) && <span className="text-[12px] text-error">{error}</span>}
    </div>
  );
}
