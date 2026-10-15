import type { TRecoveryKeyError } from '@frozik/vault/crypto/recovery-key';
import { parseRecoveryKey } from '@frozik/vault/crypto/recovery-key';
import type { IKnownVault } from '@frozik/vault/persistence/ports';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { useRouter } from 'expo-router';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { StyleSheet, Text } from 'react-native';

import { unlockOptionsOf } from '@frozik/vault-app/keys/application/unlock-options';
import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';
import { recoveryUnlockFailureText } from '@frozik/vault-app/texts/keys/keys-wording';

import { useAppModel } from '../app-model';
import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { TEXT_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { Screen } from '../kit/Screen';
import { TextField } from '../kit/TextField';
import { useKeysTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { AllVaultsLink } from '../vault/AllVaultsLink';

const paths = createVaultPaths('');

/** The master password's screen also offers the phone's biometrics, or the Emergency Kit's key. */
export const UnlockScreen = observer(function UnlockScreen({
  vault,
  unlocking,
  failure,
  onUseQuick = null,
}: {
  readonly vault: IKnownVault;
  readonly unlocking: boolean;
  readonly failure: TUnlockFailure | null;
  /** Back to the quick code the vault is still held under, after "use the master password". */
  readonly onUseQuick?: (() => void) | null;
}) {
  const { app } = useAppModel();
  const router = useRouter();
  const palette = usePalette();
  const vaultTexts = useVaultTexts();
  const keysTexts = useKeysTexts();
  const t = vaultTexts.unlock;
  const { vaultKey } = vault;
  const [biometric, setBiometric] = useState(false);
  const [password, setPassword] = useState('');
  const [withRecoveryKey, setWithRecoveryKey] = useState(false);
  const [recoveryText, setRecoveryText] = useState('');
  const [recoveryProblem, setRecoveryProblem] = useState<TRecoveryKeyError | null>(null);
  const options = unlockOptionsOf(app.lifecycle, { passkey: false, biometric });
  const passwordField = useRef<TextInput>(null);
  useEffect(() => {
    if (!withRecoveryKey) {
      passwordField.current?.focus();
    }
  }, [withRecoveryKey, failure]);

  useEffect(() => {
    let current = true;
    void app.flows.deviceUnlockOffered(vaultKey).then(offered => {
      if (current) {
        setBiometric(offered);
      }
    });
    return () => {
      current = false;
    };
  }, [app, vaultKey, failure]);

  const submitPassword = (): void => {
    if (password === '' || unlocking) {
      return;
    }
    app.unlock(password);
  };
  const submitRecoveryKey = (): void => {
    if (recoveryText === '' || unlocking) {
      return;
    }
    const parsed = parseRecoveryKey(recoveryText);
    setRecoveryProblem(parsed.ok ? null : parsed.error);
    if (parsed.ok) {
      app.unlockWithRecoveryKey(parsed.value);
    }
  };
  /** What was typed stays, locked, while it is checked; a refusal clears it for the next try. */
  const wasUnlocking = useRef(unlocking);
  useEffect(() => {
    if (wasUnlocking.current && !unlocking) {
      setPassword('');
      setRecoveryText('');
    }
    wasUnlocking.current = unlocking;
  }, [unlocking]);
  const recoveryShown = recoveryProblem ?? failure;

  return (
    <Screen title={vault.name} testID="unlock" back={<AllVaultsLink />}>
      {options?.afterFailedQuickCode === true && (
        <Notice testID="unlock-notice" tone="caution" message={keysTexts.quickScreen.failed} />
      )}
      {failure === 'not-found' && (
        <Button
          testID="reopen-from-cloud"
          variant="secondary"
          label={vaultTexts.phone.openFromCloud}
          onPress={() => router.push(paths.openFromCloud())}
        />
      )}
      {withRecoveryKey ? (
        <>
          <TextField
            testID="recovery-key"
            editable={!unlocking}
            label={keysTexts.unlock.recoveryKey}
            value={recoveryText}
            onChangeText={setRecoveryText}
            onSubmitEditing={submitRecoveryKey}
            secret
          />
          {!isNil(recoveryShown) && (
            <Text
              testID="unlock-failure"
              accessibilityRole="alert"
              style={[styles.error, { color: palette.danger }]}
            >
              {recoveryUnlockFailureText({ keys: keysTexts, vault: vaultTexts }, recoveryShown)}
            </Text>
          )}
          <Button
            testID="recovery-submit"
            label={t.submit}
            disabled={recoveryText === '' || unlocking}
            onPress={submitRecoveryKey}
          />
        </>
      ) : (
        <>
          {options?.credentials.includes('biometric') === true && (
            <Button
              testID="unlock-biometric"
              label={keysTexts.biometric.unlock}
              disabled={unlocking}
              onPress={app.unlockWithDevice}
            />
          )}
          <TextField
            testID="unlock-password"
            inputRef={passwordField}
            editable={!unlocking}
            label={t.password}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submitPassword}
            secret
          />
          {!isNil(failure) && (
            <Text
              testID="unlock-failure"
              accessibilityRole="alert"
              style={[styles.error, { color: palette.danger }]}
            >
              {t.failures[failure]}
            </Text>
          )}
          <Button
            testID="unlock-submit"
            label={t.submit}
            disabled={password === '' || unlocking}
            onPress={submitPassword}
          />
        </>
      )}
      {unlocking && <Busy label={t.unlocking} />}
      <Button
        testID="use-recovery-key"
        variant="secondary"
        label={withRecoveryKey ? keysTexts.unlock.usePassword : keysTexts.unlock.useRecovery}
        onPress={() => setWithRecoveryKey(!withRecoveryKey)}
      />
      {!isNil(onUseQuick) && (
        <Button
          testID="use-quick"
          variant="secondary"
          label={keysTexts.quickScreen.useQuick}
          onPress={onUseQuick}
        />
      )}
    </Screen>
  );
});

const styles = StyleSheet.create({
  error: { fontSize: TEXT_SIZE.small },
});
