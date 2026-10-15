import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { Button } from '@frozik/components/ui/Button';
import { DialogShell } from '@frozik/components/ui/DialogShell';
import { VaultField } from '../form/VaultField';
import { LANGUAGE } from '../texts/language';
import { vaultT } from '../texts/vault';

/** The master password again, checked in the Worker, opens protected cards for 5 minutes. */
export const ProtectedGateDialog = observer(
  ({
    session,
    onClose,
  }: {
    /** The master password checked against the vault; the failure, or `null` when it opened. */
    readonly session: {
      readonly openProtected: (password: string) => Promise<TUnlockFailure | null>;
    };
    readonly onClose: () => void;
  }) => {
    const t = vaultT.protectedGate;
    const [password, setPassword] = useState('');
    const [checking, setChecking] = useState(false);
    const [failure, setFailure] = useState<TUnlockFailure | null>(null);

    const submit = useEventCallback(async () => {
      if (password === '' || checking) {
        return;
      }
      setChecking(true);
      const result = await session.openProtected(password);
      setPassword('');
      setChecking(false);
      setFailure(result);
      if (isNil(result)) {
        onClose();
      }
    });

    return (
      <DialogShell
        open
        onClose={onClose}
        title={t.title}
        description={t.description}
        footer={
          <Button
            type="button"
            disabled={password === '' || checking}
            onClick={() => void submit()}
          >
            {checking ? t.checking : t.submit}
          </Button>
        }
      >
        <VaultField
          label={t.password}
          error={isNil(failure) ? null : vaultT.unlock.failures[failure]}
        >
          {describedBy => (
            <SecretEditor
              aria-label={t.password}
              aria-describedby={describedBy}
              aria-invalid={failure === 'wrong-password'}
              autoComplete="current-password"
              value={password}
              onValueChange={setPassword}
              onEnter={() => void submit()}
              disabled={checking}
              locale={LANGUAGE}
            />
          )}
        </VaultField>
      </DialogShell>
    );
  }
);
