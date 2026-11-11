import { observer } from 'mobx-react-lite';
import { StyleSheet, Text } from 'react-native';

import type {
  GoogleDriveConnectForm,
  TDriveConnectFailure,
} from '@frozik/vault-app/cloud/application/GoogleDriveConnectForm';
import { driveConnectFailureText } from '@frozik/vault-app/texts/cloud/cloud-wording';

import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { TEXT_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { TextField } from '../kit/TextField';
import { useCloudTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

/** The chosen place in Drive — a folder in My Drive or the app's hidden one — then Android's account picker. */
export const DriveConnect = observer(function DriveConnect({
  form,
}: {
  readonly form: GoogleDriveConnectForm;
}) {
  const palette = usePalette();
  const cloudTexts = useCloudTexts();
  const t = cloudTexts.drive;
  const { check } = form;
  const failureText = (failure: TDriveConnectFailure): string =>
    failure.kind === 'auth' && failure.reason === 'unavailable'
      ? t.phone.unavailable
      : driveConnectFailureText(cloudTexts, failure);
  return (
    <>
      <Text style={[styles.text, { color: palette.fgDim }]}>{t.phone.intro}</Text>
      <Text style={[styles.text, { color: palette.fgFaint }]}>{t.phone.spaces[form.space]}</Text>
      {form.space === 'my-drive' && (
        <>
          <TextField
            testID="drive-folder"
            label={t.folder}
            value={form.folder}
            onChangeText={form.setFolder}
          />
          <Text
            style={[styles.text, { color: form.folderProblem ? palette.danger : palette.fgFaint }]}
          >
            {form.folderProblem ? t.folderProblem : t.phone.folderHint}
          </Text>
        </>
      )}
      <Button
        testID="drive-sign-in"
        icon="login"
        label={t.signIn}
        disabled={!form.ready || form.folderProblem || check.kind === 'signing-in'}
        onPress={() => void form.connect()}
      />
      {check.kind === 'signing-in' && <Busy label={t.signingIn} />}
      {check.kind === 'looking' && <Busy label={t.looking} />}
      {check.kind === 'failed' && (
        <Notice testID="drive-failed" tone="error" message={failureText(check.failure)} />
      )}
    </>
  );
});

const styles = StyleSheet.create({
  text: { fontSize: TEXT_SIZE.small },
});
