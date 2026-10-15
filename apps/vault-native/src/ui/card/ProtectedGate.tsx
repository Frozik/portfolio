import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { TEXT_SIZE } from '../kit/metrics';
import { TextField } from '../kit/TextField';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';

/** Protected cards open for a while once the master password is typed again. */
export function ProtectedGate({ onClose }: { readonly onClose: () => void }) {
  const session = useSession();
  const palette = usePalette();
  const vaultTexts = useVaultTexts();
  const t = vaultTexts.protectedGate;
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<TUnlockFailure | null>(null);
  const submit = (): void => {
    if (password === '' || checking) {
      return;
    }
    setChecking(true);
    void session.openProtected(password).then(result => {
      setChecking(false);
      setPassword('');
      setFailure(result);
      if (isNil(result)) {
        onClose();
      }
    });
  };
  return (
    <Dialog testID="protected-gate" open title={t.title} onClose={onClose}>
      <Text style={[styles.text, { color: palette.fgDim }]}>{t.description}</Text>
      <TextField
        testID="protected-password"
        label={t.password}
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
        secret
      />
      {!isNil(failure) && (
        <Text accessibilityRole="alert" style={[styles.text, { color: palette.danger }]}>
          {vaultTexts.unlock.failures[failure]}
        </Text>
      )}
      <Button
        testID="protected-submit"
        label={checking ? t.checking : t.submit}
        disabled={password === '' || checking}
        onPress={submit}
      />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: TEXT_SIZE.small },
});
