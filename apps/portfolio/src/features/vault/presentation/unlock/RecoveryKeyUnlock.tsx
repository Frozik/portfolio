import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { TRecoveryKeyError } from '@frozik/vault/crypto/recovery-key';
import { parseRecoveryKey } from '@frozik/vault/crypto/recovery-key';
import type { TUnlockFailure } from '@frozik/vault/lifecycle/lifecycle-state';
import { isNil } from 'lodash-es';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Button } from '../../../../shared/ui/Button';
import { VaultField } from '../components/VaultField';
import { vaultT } from '../translations';
import { keysT } from '../translations/keys';

function failureText(failure: TUnlockFailure | TRecoveryKeyError): string {
  switch (failure) {
    case 'malformed':
    case 'checksum-mismatch':
      return keysT.recoveryKeyProblems[failure];
    case 'wrong-password':
      return keysT.unlock.wrongKey;
    default:
      return vaultT.unlock.failures[failure];
  }
}

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
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<TRecoveryKeyError | null>(null);

  const submit = useEventCallback(() => {
    if (text === '' || unlocking) {
      return;
    }
    const parsed = parseRecoveryKey(text);
    setProblem(parsed.ok ? null : parsed.error);
    if (parsed.ok) {
      onUnlock(parsed.value);
      setText('');
    }
  });
  const shown = problem ?? failure;

  return (
    <>
      <VaultField label={t.recoveryKey} error={isNil(shown) ? null : failureText(shown)}>
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
            locale={getCurrentLanguage()}
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
