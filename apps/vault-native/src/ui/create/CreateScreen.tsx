import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  MASTER_PASSWORD_MIN_LENGTH,
  MASTER_PASSWORD_SUGGESTED_LENGTH,
} from '@frozik/vault-app/keys/domain/master-password';
import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';
import { createVaultProblemText } from '@frozik/vault-app/texts/keys/keys-wording';

import { CLOUD_TEXTS } from '@frozik/vault-app/texts/cloud/cloud-texts';
import { useAppModel } from '../app-model';
import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { Checkbox } from '../kit/Checkbox';
import { GAP, TEXT_SIZE } from '../kit/metrics';
import { Screen } from '../kit/Screen';
import { TextField } from '../kit/TextField';
import { useTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useBack } from '../useBack';
import { StrengthBar } from './StrengthBar';
import { useLeaveOpenVault, useOpenWhenStarted } from './useOpenWhenStarted';

const paths = createVaultPaths('');

/** A new vault: on this phone only, or in the cloud folder the opening reached. */
export const CreateScreen = observer(function CreateScreen({
  inCloud,
}: {
  readonly inCloud: boolean;
}) {
  const { app } = useAppModel();
  const palette = usePalette();
  const vaultTexts = useVaultTexts();
  const cloudTexts = useTexts(CLOUD_TEXTS);
  const t = vaultTexts.create;
  const [started, setStarted] = useState(false);
  const cancel = useBack(inCloud ? paths.openFromCloud() : paths.start());
  useOpenWhenStarted(app, started);
  useLeaveOpenVault(app);
  useEffect(() => {
    app.openCreateForm();
    return app.closeCreateForm;
  }, [app]);
  const { createForm: form } = app;

  if (app.lifecycle.kind === 'creating') {
    return (
      <Screen title={t.title} testID="creating">
        <Busy label={t.creating} />
        <Text accessibilityRole="text" style={{ color: palette.fgDim }}>
          {t.creating}
        </Text>
      </Screen>
    );
  }
  if (isNil(form)) {
    return (
      <Screen title={t.title} testID="create">
        <Busy label={t.title} />
      </Screen>
    );
  }
  const submit = (): void => {
    if (inCloud) {
      app.cloud.prepareNewVaultHere(form.name.trim());
    }
    setStarted(true);
    app.submitCreateForm();
  };
  const passwordProblem =
    form.password !== '' && form.problem === 'too-short'
      ? createVaultProblemText(vaultTexts, 'too-short')
      : null;
  const mismatch =
    form.confirmation !== '' && form.problem === 'mismatch'
      ? createVaultProblemText(vaultTexts, 'mismatch')
      : null;
  return (
    <Screen title={t.title} testID="create">
      {inCloud && (
        <Text style={[styles.hint, { color: palette.fgDim }]}>
          {cloudTexts.section.createdHere}
        </Text>
      )}
      <TextField
        testID="create-name"
        label={t.name}
        value={form.name}
        onChangeText={form.setName}
      />
      <TextField
        testID="create-description"
        label={t.description}
        value={form.description}
        onChangeText={form.setDescription}
      />
      <Text style={[styles.hint, { color: palette.fgFaint }]}>{t.descriptionHint}</Text>
      <TextField
        testID="create-password"
        label={t.password}
        value={form.password}
        onChangeText={form.setPassword}
        secret
      />
      <Text style={[styles.hint, { color: palette.fgFaint }]}>
        {t.passwordHint(MASTER_PASSWORD_MIN_LENGTH, MASTER_PASSWORD_SUGGESTED_LENGTH)}
      </Text>
      {passwordProblem !== null && (
        <Text style={[styles.hint, { color: palette.danger }]}>{passwordProblem}</Text>
      )}
      {!isNil(form.strength) && <StrengthBar strength={form.strength} />}
      <TextField
        testID="create-confirmation"
        label={t.confirmation}
        value={form.confirmation}
        onChangeText={form.setConfirmation}
        onSubmitEditing={submit}
        secret
      />
      {mismatch !== null && (
        <Text style={[styles.hint, { color: palette.danger }]}>{mismatch}</Text>
      )}
      <Checkbox
        testID="create-acknowledged"
        label={t.acknowledgement}
        checked={form.acknowledged}
        onChange={form.setAcknowledged}
      />
      <View style={styles.actions}>
        <Button
          testID="create-submit"
          label={t.submit}
          disabled={!isNil(form.problem)}
          onPress={submit}
        />
        <Button testID="create-cancel" variant="secondary" label={t.cancel} onPress={cancel} />
      </View>
      {!isNil(form.problem) && (
        <Text testID="create-problem" style={[styles.hint, { color: palette.fgFaint }]}>
          {createVaultProblemText(vaultTexts, form.problem)}
        </Text>
      )}
    </Screen>
  );
});

const styles = StyleSheet.create({
  hint: { fontSize: TEXT_SIZE.caption },
  actions: { gap: GAP },
});
