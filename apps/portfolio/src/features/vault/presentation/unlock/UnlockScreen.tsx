import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';
import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { IKnownVault } from '@frozik/vault/persistence/ports';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { Button } from '@frozik/components/ui/Button';
import { CardFrame } from '@frozik/components/ui/CardFrame';
import { Spinner } from '@frozik/components/ui/Spinner';
import { pageLanguage } from '@frozik/utils/i18n/page-language';
import { VaultField } from '@frozik/vault-react/form/VaultField';
import { useKeptWhileChecked } from '@frozik/vault-react/hooks/useKeptWhileChecked';
import { keysT } from '@frozik/vault-react/texts/keys';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { PasskeyUnlock } from '@frozik/vault-react/unlock/PasskeyUnlock';
import { RecoveryKeyUnlock } from '@frozik/vault-react/unlock/RecoveryKeyUnlock';

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
    notice = null,
  }: {
    readonly vault: IKnownVault;
    readonly unlocking: boolean;
    readonly failure: TUnlockFailure | null;
    readonly onUnlock: (password: string) => void;
    readonly onUnlockWithRecoveryKey: (recoveryKey: TBytes) => void;
    readonly passkeys: Pick<ComponentProps<typeof PasskeyUnlock>, 'load' | 'unlock'> | null;
    /** Why the master password is asked for now, when the screen should say it (a failed quick code). */
    readonly notice?: string | null;
  }) => {
    const t = vaultT.unlock;
    const [password, setPassword] = useKeptWhileChecked(unlocking);
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
    });

    return (
      <CardFrame className="flex max-w-[480px] flex-col gap-5 p-6">
        <h2 className="text-[20px] font-medium text-landing-fg">{vault.name}</h2>
        {!isNil(notice) && (
          <p role="status" data-testid="unlock-notice" className="text-[13px] text-warning">
            {notice}
          </p>
        )}
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
            {!isNil(passkeys) && (
              <PasskeyUnlock
                {...passkeys}
                unlocking={unlocking}
                wrongPasskey={triedPasskey && failure === 'wrong-password'}
                onTry={() => setTriedPasskey(true)}
              />
            )}
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
                  locale={pageLanguage()}
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
