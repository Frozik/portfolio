import type { TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { useRouter } from 'expo-router';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import { BackHandler, StyleSheet, Text } from 'react-native';

import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';
import { adoptFailureText } from '@frozik/vault-app/texts/cloud/cloud-wording';

import { useAppModel } from '../app-model';
import { useLeaveOpenVault } from '../create/useOpenWhenStarted';
import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { TEXT_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { Screen } from '../kit/Screen';
import { useCloudTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useBack } from '../useBack';
import { FoundVaults } from './FoundVaults';
import { WebDavConnect } from './WebDavConnect';

const paths = createVaultPaths('');

/**
 * A second device's first screen: reach a WebDAV folder, pick the vault found
 * there; it is copied to this phone and the usual unlock opens it.
 */
export const OpenFromCloudScreen = observer(function OpenFromCloudScreen() {
  const { app } = useAppModel();
  const router = useRouter();
  const palette = usePalette();
  const cloudTexts = useCloudTexts();
  const close = useBack(paths.start());
  const { cloud } = app;
  const { step } = cloud;
  useLeaveOpenVault(app);
  const here = useRef(true);
  useEffect(
    () => () => {
      here.current = false;
      cloud.closeDriveForm();
      cloud.closeWebDavForm();
    },
    [cloud]
  );
  const stepping = step.kind !== 'choose';
  useEffect(() => {
    if (!stepping) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      cloud.back();
      return true;
    });
    return () => subscription.remove();
  }, [cloud, stepping]);
  const opened = (vaultKey: TVaultKey | null): void => {
    if (here.current && !isNil(vaultKey)) {
      app.choose(vaultKey);
      router.dismissTo(paths.start());
      router.push(paths.vault(vaultKey));
    }
  };
  const openFromWebDav = (path: TStoragePath): void => void cloud.openFromWebDav(path).then(opened);
  const createHere = (): void => router.push(paths.createInCloud());

  const content = (() => {
    switch (step.kind) {
      case 'choose':
        return (
          <>
            <Button
              testID="choose-webdav"
              variant="secondary"
              label={cloudTexts.webdav.connect}
              onPress={cloud.openWebDavForm}
            />
            <Text style={[styles.text, { color: palette.fgFaint }]}>
              {cloudTexts.drive.notOnPhone}
            </Text>
          </>
        );
      case 'connect':
        return step.cloud.kind === 'webdav' ? <WebDavConnect form={step.cloud.form} /> : null;
      case 'pick':
        return step.cloud.kind === 'webdav' && step.cloud.form.check.kind === 'reachable' ? (
          <>
            <Notice testID="webdav-reachable" message={cloudTexts.webdav.reachable} />
            <FoundVaults
              vaults={step.cloud.form.check.reach.vaults}
              onOpen={openFromWebDav}
              onCreate={createHere}
            />
          </>
        ) : null;
      default:
        return assertNever(step);
    }
  })();

  return (
    <Screen title={cloudTexts.opening.title} testID="open-from-cloud-screen">
      <Text style={[styles.text, { color: palette.fgDim }]}>{cloudTexts.opening.introPhone}</Text>
      {content}
      {cloud.opening.kind === 'opening' && <Busy label={cloudTexts.opening.title} />}
      {cloud.opening.kind === 'failed' && (
        <Notice
          testID="open-failed"
          tone="error"
          message={adoptFailureText(cloudTexts, cloud.opening.failure)}
        />
      )}
      {step.kind !== 'choose' && (
        <Button
          variant="secondary"
          label={cloudTexts.wizard.back}
          disabled={cloud.opening.kind === 'opening'}
          onPress={cloud.back}
        />
      )}
      <Button
        testID="close-open-from-cloud"
        variant="secondary"
        label={cloudTexts.webdav.cancel}
        disabled={cloud.opening.kind === 'opening'}
        onPress={close}
      />
    </Screen>
  );
});

const styles = StyleSheet.create({
  text: { fontSize: TEXT_SIZE.small },
});
