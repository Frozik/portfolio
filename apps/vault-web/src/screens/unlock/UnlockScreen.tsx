import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';
import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { IKnownVault } from '@frozik/vault/persistence/ports';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import { Button } from '@frozik/components/ui/Button';
import { Spinner } from '@frozik/components/ui/Spinner';
import { unlockOptionsOf } from '@frozik/vault-app/keys/application/unlock-options';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { VaultField } from '@frozik/vault-react/form/VaultField';
import { useKeptWhileChecked } from '@frozik/vault-react/hooks/useKeptWhileChecked';
import { keysT } from '@frozik/vault-react/texts/keys';
import { LANGUAGE } from '@frozik/vault-react/texts/language';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { PasskeyUnlock } from '@frozik/vault-react/unlock/PasskeyUnlock';
import { RecoveryKeyUnlock } from '@frozik/vault-react/unlock/RecoveryKeyUnlock';
import { ScreenFrame } from '../frame/ScreenFrame';
import { paths } from '../paths';
import { AllVaultsLink } from './AllVaultsLink';

/** The web offers passkeys of this site; biometrics belong to the Android app. */
const WEB_ENROLMENTS = { passkey: true, biometric: false } as const;

/**
 * A full lock: the master password (the browser may remember it, filed under
 * the vault's name), a passkey of this device, or the Emergency Kit's key.
 * The password leaves the field on submit; a wrong one is announced.
 */
export const UnlockScreen = observer(
  ({
    app,
    vault,
    unlocking,
    failure,
  }: {
    readonly app: VaultApp;
    readonly vault: IKnownVault;
    readonly unlocking: boolean;
    readonly failure: TUnlockFailure | null;
  }) => {
    const t = vaultT.unlock;
    const options = unlockOptionsOf(app.lifecycle, WEB_ENROLMENTS);
    const [password, setPassword] = useKeptWhileChecked(unlocking);
    const [withRecoveryKey, setWithRecoveryKey] = useState(false);
    const [triedPasskey, setTriedPasskey] = useState(false);
    const passwordFailure = triedPasskey ? null : failure;
    const field = useRef<IRichEditorHandle>(null);
    const { vaultKey } = vault;

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
      app.unlock(password);
    });
    const loadPasskeys = useCallback(async () => {
      const [credentialIds, capabilities] = await Promise.all([
        app.flows.passkeysOfLocked(vaultKey),
        app.flows.passkeyCapabilities(),
      ]);
      return { credentialIds, capabilities };
    }, [app, vaultKey]);
    const unlockWithPasskey = useCallback(
      (credentialIds: readonly TBytes[]) => app.unlockWithPasskey(vaultKey, credentialIds),
      [app, vaultKey]
    );

    return (
      <ScreenFrame className="justify-center" header={<AllVaultsLink />}>
        <h1 className="text-[22px] font-semibold text-fg">{vault.name}</h1>
        {options?.afterFailedQuickCode === true && (
          <p role="status" data-testid="unlock-notice" className="text-[14px] text-caution">
            {keysT.quickScreen.failed}
          </p>
        )}
        {failure === 'not-found' && (
          <Link
            to={paths.openFromCloud()}
            className="text-[15px] text-fg underline"
            data-testid="reopen-from-cloud"
          >
            {vaultT.phone.openFromCloud}
          </Link>
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
          <div className="flex flex-col gap-4" data-testid="recovery-key-unlock">
            <RecoveryKeyUnlock
              unlocking={unlocking}
              failure={failure}
              onUnlock={app.unlockWithRecoveryKey}
            />
          </div>
        ) : (
          <>
            {options?.credentials.includes('passkey') === true && (
              <PasskeyUnlock
                load={loadPasskeys}
                unlock={unlockWithPasskey}
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
                  locale={LANGUAGE}
                />
              )}
            </VaultField>
            <Button
              type="button"
              size="lg"
              disabled={password === '' || unlocking}
              onClick={submit}
            >
              {t.submit}
            </Button>
            {unlocking && (
              <p role="status" className="flex items-center gap-2 text-[14px] text-fg-dim">
                <Spinner />
                {t.unlocking}
              </p>
            )}
          </>
        )}
        <button
          type="button"
          className="min-h-11 self-start text-[14px] text-fg-dim underline"
          data-testid="use-recovery-key"
          onClick={() => setWithRecoveryKey(!withRecoveryKey)}
        >
          {withRecoveryKey ? keysT.unlock.usePassword : keysT.unlock.useRecovery}
        </button>
      </ScreenFrame>
    );
  }
);
