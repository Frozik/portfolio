import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ChangePasswordForm } from '@frozik/vault-app/keys/application/ChangePasswordForm';
import { MASTER_PASSWORD_MIN_LENGTH } from '@frozik/vault-app/keys/domain/master-password';
import { changePasswordProblemText } from '@frozik/vault-app/texts/keys/keys-wording';

import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { TEXT_SIZE } from '../kit/metrics';
import { TextField } from '../kit/TextField';
import { useKeysTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';

/** A new master password for the same key: after a recovery the recovery key stands for the old one. */
export const ChangePasswordSection = observer(function ChangePasswordSection() {
  const session = useSession();
  const palette = usePalette();
  const keysTexts = useKeysTexts();
  const vaultTexts = useVaultTexts();
  const t = keysTexts.changePassword;
  const [form, setForm] = useState<ChangePasswordForm | null>(null);
  if (isNil(form)) {
    return (
      <Button
        testID="change-password-open"
        variant="secondary"
        label={t.open}
        onPress={() =>
          setForm(
            new ChangePasswordForm(session.keys, session.keys.recovering ? 'recovery' : 'password')
          )
        }
      />
    );
  }
  const { step, problem } = form;
  if (step.kind === 'changed') {
    return (
      <>
        <Text testID="password-changed" style={[styles.text, { color: palette.positive }]}>
          {t.changed}
        </Text>
        <Button
          testID="password-changed-close"
          variant="secondary"
          label={vaultTexts.phone.close}
          onPress={() => setForm(null)}
        />
      </>
    );
  }
  return (
    <>
      <Text style={[styles.text, { color: palette.fgDim }]}>{t.intro}</Text>
      <TextField
        testID="current-password"
        label={form.mode === 'recovery' ? t.currentRecovery : t.current}
        value={form.current}
        onChangeText={form.setCurrent}
        secret
      />
      <TextField
        testID="new-password"
        label={t.password}
        value={form.password}
        onChangeText={form.setPassword}
        secret
      />
      <Text style={[styles.hint, { color: palette.fgFaint }]}>
        {t.passwordHint(MASTER_PASSWORD_MIN_LENGTH)}
      </Text>
      <TextField
        testID="new-password-again"
        label={t.confirmation}
        value={form.confirmation}
        onChangeText={form.setConfirmation}
        secret
      />
      {!isNil(problem) && form.password !== '' && (
        <Text style={[styles.hint, { color: palette.fgFaint }]}>
          {changePasswordProblemText(keysTexts, problem)}
        </Text>
      )}
      {step.kind === 'editing' && !isNil(step.failure) && (
        <Text accessibilityRole="alert" style={[styles.text, { color: palette.danger }]}>
          {vaultTexts.unlock.failures[step.failure]}
        </Text>
      )}
      {step.kind === 'changing' ? (
        <Busy label={t.changing} />
      ) : (
        <Button
          testID="change-password-submit"
          label={t.submit}
          disabled={!isNil(problem)}
          onPress={() => void form.submit()}
        />
      )}
      <Button
        variant="secondary"
        label={t.cancel}
        disabled={step.kind === 'changing'}
        onPress={() => setForm(null)}
      />
    </>
  );
});

const styles = StyleSheet.create({
  text: { fontSize: TEXT_SIZE.small },
  hint: { fontSize: TEXT_SIZE.caption },
});
