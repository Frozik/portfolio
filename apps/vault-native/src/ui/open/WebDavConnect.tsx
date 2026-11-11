import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { StyleSheet, Text } from 'react-native';

import type { WebDavConnectForm } from '@frozik/vault-app/cloud/application/WebDavConnectForm';
import { webDavFailureText } from '@frozik/vault-app/texts/cloud/cloud-wording';

import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { TEXT_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { TextField } from '../kit/TextField';
import { useCloudTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

/** The chosen service's folder, the login and an app password; "Check" runs the probe. A phone needs no CORS. */
export const WebDavConnect = observer(function WebDavConnect({
  form,
}: {
  readonly form: WebDavConnectForm;
}) {
  const palette = usePalette();
  const cloudTexts = useCloudTexts();
  const t = cloudTexts.webdav;
  const { addressProblem, check } = form;
  const addressError =
    form.endpoint !== '' && !isNil(addressProblem) ? t.addressProblems[addressProblem] : null;
  return (
    <>
      <Text style={[styles.text, { color: palette.fgDim }]}>{t.introPhone}</Text>
      {form.preset?.hosting === 'self-hosted' && (
        <TextField
          testID="webdav-server"
          label={t.server}
          value={form.server}
          onChangeText={form.setServer}
          kind="url"
        />
      )}
      <TextField
        testID="webdav-address"
        label={t.address}
        value={form.endpoint}
        onChangeText={form.setEndpoint}
        kind="url"
      />
      {addressError !== null && (
        <Text style={[styles.text, { color: palette.danger }]}>{addressError}</Text>
      )}
      <TextField
        testID="webdav-username"
        label={t.username}
        value={form.username}
        onChangeText={form.setUsername}
      />
      <TextField
        testID="webdav-password"
        label={t.password}
        value={form.password}
        onChangeText={form.setPassword}
        secret
      />
      <Text style={[styles.text, { color: palette.fgFaint }]}>{t.passwordHint}</Text>
      <Button
        testID="webdav-check"
        label={t.check}
        disabled={!form.canCheck || check.kind === 'checking'}
        onPress={() => void form.runCheck()}
      />
      {check.kind === 'checking' && <Busy label={t.checking} />}
      {check.kind === 'failed' && (
        <Notice
          testID={`webdav-${check.failure.kind}`}
          tone="error"
          message={webDavFailureText(cloudTexts, check.failure)}
        />
      )}
    </>
  );
});

const styles = StyleSheet.create({
  text: { fontSize: TEXT_SIZE.small },
});
