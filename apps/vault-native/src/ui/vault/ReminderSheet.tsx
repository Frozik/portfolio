import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { ReminderModel } from '@frozik/vault-app/keys/application/ReminderModel';

import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { TEXT_SIZE } from '../kit/metrics';
import { TextField } from '../kit/TextField';
import { useKeysTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

/** Once a week the master password is typed here once: it stays the way in when the shortcuts are gone. */
export const ReminderSheet = observer(function ReminderSheet({
  reminder,
}: {
  readonly reminder: ReminderModel;
}) {
  const palette = usePalette();
  const vaultTexts = useVaultTexts();
  const t = useKeysTexts().reminder;
  const [password, setPassword] = useState('');
  const { state } = reminder;
  if (state.kind === 'quiet') {
    return null;
  }
  return (
    <Dialog testID="reminder" open title={t.title} onClose={reminder.dismiss}>
      <Text style={[styles.text, { color: palette.fgDim }]}>{t.body}</Text>
      <TextField
        testID="reminder-password"
        label={t.password}
        value={password}
        onChangeText={setPassword}
        secret
      />
      {state.kind === 'due' && !isNil(state.failure) && (
        <Text accessibilityRole="alert" style={[styles.text, { color: palette.danger }]}>
          {vaultTexts.unlock.failures[state.failure]}
        </Text>
      )}
      {state.kind === 'checking' ? (
        <Busy label={t.submit} />
      ) : (
        <Button
          testID="reminder-submit"
          label={t.submit}
          disabled={password === ''}
          onPress={() => {
            void reminder.submit(password);
            setPassword('');
          }}
        />
      )}
      <Button variant="secondary" label={t.later} onPress={reminder.dismiss} />
    </Dialog>
  );
});

const styles = StyleSheet.create({
  text: { fontSize: TEXT_SIZE.small },
});
