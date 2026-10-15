import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { rotationFailureText } from '@frozik/vault-app/texts/keys/keys-wording';

import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { TEXT_SIZE } from '../kit/metrics';
import { TextField } from '../kit/TextField';
import { useKeysTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';

/** Everything sealed again under a new key, when the key itself may have leaked. */
export const RotateKeySection = observer(function RotateKeySection() {
  const { rotation } = useSession();
  const palette = usePalette();
  const vaultTexts = useVaultTexts();
  const keysTexts = useKeysTexts();
  const t = keysTexts.rotation;
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const { state } = rotation;
  if (!open) {
    return (
      <Button
        testID="rotate-open"
        variant="secondary"
        label={t.title}
        onPress={() => setOpen(true)}
      />
    );
  }
  return (
    <>
      <Text style={[styles.text, { color: palette.fgDim }]}>{t.intro}</Text>
      {t.consequences.map(consequence => (
        <Text key={consequence} style={[styles.text, { color: palette.fgDim }]}>
          • {consequence}
        </Text>
      ))}
      <TextField
        testID="rotate-password"
        label={t.password}
        value={password}
        onChangeText={setPassword}
        secret
      />
      {state.kind === 'failed' && (
        <Text accessibilityRole="alert" style={[styles.text, { color: palette.danger }]}>
          {rotationFailureText({ keys: keysTexts, vault: vaultTexts }, state.failure)}
        </Text>
      )}
      {state.kind === 'working' ? (
        <Busy label={t.working} />
      ) : (
        <Button
          testID="rotate-submit"
          variant="danger"
          label={t.submit}
          disabled={password === ''}
          onPress={() => {
            void rotation.rotate(password);
            setPassword('');
          }}
        />
      )}
      {state.kind !== 'working' && (
        <Button
          testID="rotate-cancel"
          variant="secondary"
          label={t.cancel}
          onPress={() => {
            setPassword('');
            setOpen(false);
          }}
        />
      )}
    </>
  );
});

const styles = StyleSheet.create({
  text: { fontSize: TEXT_SIZE.small },
});
