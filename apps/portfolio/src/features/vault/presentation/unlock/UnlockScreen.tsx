import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';
import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { TUnlockFailure } from '@frozik/vault/lifecycle/lifecycle-state';
import type { IKnownVault } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Button } from '../../../../shared/ui/Button';
import { CardFrame } from '../../../../shared/ui/CardFrame';
import { Spinner } from '../../../../shared/ui/Spinner';
import { VaultField } from '../components/VaultField';
import { vaultT } from '../translations';
import { keysT } from '../translations/keys';
import { PasskeyUnlock } from './PasskeyUnlock';
import { RecoveryKeyUnlock } from './RecoveryKeyUnlock';

/**
 * The browser may remember the master
 * password: `current-password` with a hidden username naming the vault. The
 * password leaves this component on submit and the field is emptied.
 */
export const UnlockScreen = observer(
  ({
    vault,
    unlocking,
    failure,
    onUnlock,
    onUnlockWithRecoveryKey,
    passkeys,
  }: {
    readonly vault: IKnownVault;
    readonly unlocking: boolean;
    readonly failure: TUnlockFailure | null;
    readonly onUnlock: (password: string) => void;
    readonly onUnlockWithRecoveryKey: (recoveryKey: TBytes) => void;
    readonly passkeys: Pick<ComponentProps<typeof PasskeyUnlock>, 'load' | 'unlock'>;
  }) => {
    const t = vaultT.unlock;
    const [password, setPassword] = useState('');
    const [withRecoveryKey, setWithRecoveryKey] = useState(false);
    const [triedPasskey, setTriedPasskey] = useState(false);
    const passwordFailure = triedPasskey ? null : failure;
    const field = useRef<IRichEditorHandle>(null);

    useEffect(() => {
      if (!unlocking) {
        field.current?.focus();
      }
    }, [unlocking, failure]);

    const submit = useEventCallback(() => {
      if (password === '' || unlocking) {
        return;
      }
      setTriedPasskey(false);
      onUnlock(password);
      setPassword('');
    });

    return (
      <CardFrame className="flex max-w-[480px] flex-col gap-5 p-6">
        <h2 className="text-[20px] font-medium text-landing-fg">{vault.name}</h2>
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={vault.name}
          readOnly
          hidden
        />
        {withRecoveryKey ? (
          <RecoveryKeyUnlock
            unlocking={unlocking}
            failure={failure}
            onUnlock={onUnlockWithRecoveryKey}
          />
        ) : (
          <>
            <PasskeyUnlock
              {...passkeys}
              unlocking={unlocking}
              wrongPasskey={triedPasskey && failure === 'wrong-password'}
              onTry={() => setTriedPasskey(true)}
            />
            <VaultField
              label={t.password}
              error={isNil(passwordFailure) ? null : t.failures[passwordFailure]}
              errorKind={passwordFailure}
            >
              {describedBy => (
                <SecretEditor
                  ref={field}
                  aria-label={t.password}
                  aria-describedby={describedBy}
                  aria-invalid={passwordFailure === 'wrong-password'}
                  autoComplete="current-password"
                  value={password}
                  onValueChange={setPassword}
                  onEnter={submit}
                  disabled={unlocking}
                  locale={getCurrentLanguage()}
                />
              )}
            </VaultField>
            <div className="flex items-center gap-3">
              <Button type="button" disabled={password === '' || unlocking} onClick={submit}>
                {t.submit}
              </Button>
              {unlocking && (
                <span className="flex items-center gap-2 text-[13px] text-landing-fg-dim">
                  <Spinner />
                  {t.unlocking}
                </span>
              )}
            </div>
          </>
        )}
        <button
          type="button"
          className="self-start text-[13px] text-landing-fg-dim underline"
          onClick={() => setWithRecoveryKey(!withRecoveryKey)}
        >
          {withRecoveryKey ? keysT.unlock.usePassword : keysT.unlock.useRecovery}
        </button>
      </CardFrame>
    );
  }
);
