import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { TRecoveryKeyError } from '@frozik/vault/crypto/recovery-key';
import { parseRecoveryKey } from '@frozik/vault/crypto/recovery-key';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { Button } from '@frozik/components/ui/Button';
import { recoveryUnlockFailureText } from '@frozik/vault-app/texts/keys/keys-wording';
import { VaultField } from '../form/VaultField';
import { useKeptWhileChecked } from '../hooks/useKeptWhileChecked';
import { keysT } from '../texts/keys';
import { LANGUAGE } from '../texts/language';
import { vaultT } from '../texts/vault';

/** The Emergency Kit's key, read as typed: a typo is told apart from a wrong key. */
export function RecoveryKeyUnlock({
  unlocking,
  failure,
  onUnlock,
}: {
  readonly unlocking: boolean;
  readonly failure: TUnlockFailure | null;
  readonly onUnlock: (recoveryKey: TBytes) => void;
}) {
  const t = keysT.unlock;
  const [text, setText] = useKeptWhileChecked(unlocking);
  const [problem, setProblem] = useState<TRecoveryKeyError | null>(null);

  const submit = useEventCallback(() => {
    if (text === '' || unlocking) {
      return;
    }
    const parsed = parseRecoveryKey(text);
    setProblem(parsed.ok ? null : parsed.error);
    if (parsed.ok) {
      onUnlock(parsed.value);
    }
  });
  const shown = problem ?? failure;

  return (
    <>
      <VaultField
        label={t.recoveryKey}
        error={
          isNil(shown) ? null : recoveryUnlockFailureText({ keys: keysT, vault: vaultT }, shown)
        }
        errorKind={shown}
      >
        {describedBy => (
          <SecretEditor
            aria-label={t.recoveryKey}
            aria-describedby={describedBy}
            aria-invalid={!isNil(shown)}
            autoComplete="off"
            value={text}
            onValueChange={setText}
            onEnter={submit}
            disabled={unlocking}
            locale={LANGUAGE}
          />
        )}
      </VaultField>
      <Button
        type="button"
        className="self-start"
        disabled={text === '' || unlocking}
        onClick={submit}
      >
        {vaultT.unlock.submit}
      </Button>
    </>
  );
}
