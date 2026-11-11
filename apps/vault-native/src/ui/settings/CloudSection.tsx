import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';

import { cloudStatusText } from '@frozik/vault-app/texts/cloud/cloud-wording';

import { useAppModel } from '../app-model';
import { Button } from '../kit/Button';
import { TEXT_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { CloudChoice } from '../open/CloudChoice';
import { DriveConnect } from '../open/DriveConnect';
import { WebDavConnect } from '../open/WebDavConnect';
import { useCloudTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';

/**
 * Where the vault is kept besides this phone: Google Drive or a WebDAV folder to connect, the
 * state, sync now, signing in to Google again, disconnect.
 */
export const CloudSection = observer(function CloudSection() {
  const { app } = useAppModel();
  const session = useSession();
  const palette = usePalette();
  const cloudTexts = useCloudTexts();
  const vaultTexts = useVaultTexts();
  const t = cloudTexts.section;
  const { cloud } = app;
  const { status, connection } = session.cloud;
  useEffect(
    () => () => {
      cloud.closeDriveForm();
      cloud.closeWebDavForm();
    },
    [cloud]
  );
  if (status.kind !== 'none') {
    return (
      <>
        {!isNil(connection) && (
          <Text testID="cloud-location" style={[styles.text, { color: palette.fgDim }]}>
            {connection.location.kind === 'webdav'
              ? t.webdavIn(connection.location.url, connection.location.path)
              : t.driveIn(
                  cloudTexts.drive.spaces[connection.location.space].label,
                  connection.location.path
                )}
          </Text>
        )}
        <Text testID="cloud-section-status" style={[styles.text, { color: palette.fgDim }]}>
          {cloudStatusText({ cloud: cloudTexts, vault: vaultTexts }, status)}
        </Text>
        {status.kind === 'sign-in-needed' && (
          <Button
            testID="cloud-sign-in"
            icon="login"
            label={cloudTexts.status.signIn}
            onPress={() => void session.cloud.signIn()}
          />
        )}
        <Button
          testID="sync-now"
          variant="secondary"
          label={cloudTexts.status.sync}
          disabled={status.kind === 'syncing'}
          onPress={session.cloud.syncNow}
        />
        <Button
          testID="cloud-disconnect"
          variant="secondary"
          label={t.disconnect}
          onPress={() => void cloud.disconnect(session)}
        />
        <Text style={[styles.note, { color: palette.fgFaint }]}>{t.disconnectNote}</Text>
      </>
    );
  }
  const { step } = cloud;
  return (
    <>
      <Text style={[styles.text, { color: palette.fgDim }]}>{t.localOnlyPhone}</Text>
      <CloudChoice cloud={cloud} />
      {step.kind === 'connect' &&
        (step.cloud.kind === 'webdav' ? (
          <WebDavConnect form={step.cloud.form} />
        ) : (
          <DriveConnect form={step.cloud.form} />
        ))}
      {step.kind === 'pick' &&
        step.cloud.kind === 'drive' &&
        step.cloud.form.check.kind === 'found' && (
          <>
            {step.cloud.form.check.vaults.length > 0 && (
              <Notice tone="caution" message={t.mergesWith} />
            )}
            <Button
              testID="keep-here"
              label={t.keepHere}
              onPress={() => void cloud.keepInDrive(session)}
            />
          </>
        )}
      {step.kind === 'pick' && step.cloud.kind === 'webdav' && (
        <>
          {step.cloud.form.check.kind === 'reachable' &&
            step.cloud.form.check.reach.vaults.length > 0 && (
              <Notice tone="caution" message={t.mergesWith} />
            )}
          <Button
            testID="keep-here"
            label={t.keepHere}
            onPress={() => void cloud.keepInWebDav(session)}
          />
        </>
      )}
      {step.kind !== 'choose' && (
        <Button variant="secondary" label={cloudTexts.wizard.back} onPress={cloud.back} />
      )}
    </>
  );
});

const styles = StyleSheet.create({
  text: { fontSize: TEXT_SIZE.small },
  note: { fontSize: TEXT_SIZE.caption },
});
