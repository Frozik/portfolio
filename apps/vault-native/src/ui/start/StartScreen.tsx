import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isNil } from 'lodash-es';

import { launchVaultOf } from '@frozik/vault-app/device/domain/launch-vault';
import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';
import { adoptFailureText } from '@frozik/vault-app/texts/cloud/cloud-wording';

import { useAppModel } from '../app-model';
import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { GAP, TEXT_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { Screen } from '../kit/Screen';
import { ThemeChoice } from '../settings/ThemeChoice';
import { useCloudTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { UpdateNotice } from '../UpdateNotice';
import { VaultList } from './VaultList';

const PRODUCT_NAME = 'Ciphra Vault';
const paths = createVaultPaths('');

/** The first screen: the vaults this phone knows, and the ways to get one. */
export const StartScreen = observer(function StartScreen() {
  const { app, updates, version, takeLaunch } = useAppModel();
  const cloudTexts = useCloudTexts();
  const { fileOpening } = app;
  const openFile = (): void => {
    void fileOpening?.open().then(vaultKey => {
      if (!isNil(vaultKey)) {
        router.push(paths.vault(vaultKey));
      }
    });
  };
  const router = useRouter();
  const palette = usePalette();
  const known = app.registry.vaults.value;
  useEffect(() => {
    if (isNil(known)) {
      return;
    }
    const launch = takeLaunch();
    const vaultKey = isNil(launch) ? null : launchVaultOf(known, launch.locked);
    if (!isNil(vaultKey)) {
      router.push(paths.vault(vaultKey));
    }
  }, [known, takeLaunch, router]);
  const t = useVaultTexts();
  return (
    <Screen
      title={PRODUCT_NAME}
      testID="start"
      footer={
        <Text style={[styles.footer, { color: palette.fgFaint }]}>
          {PRODUCT_NAME} <Text testID="app-version">{version}</Text>
        </Text>
      }
    >
      <UpdateNotice watch={updates} />
      <Text accessibilityRole="header" style={[styles.heading, { color: palette.fg }]}>
        {t.deviceVaults.title}
      </Text>
      <VaultList />
      <View style={styles.actions}>
        <Button
          testID="open-from-cloud"
          label={t.phone.openFromCloud}
          onPress={() => router.push(paths.openFromCloud())}
        />
        {!isNil(fileOpening) && (
          <Button
            testID="open-file"
            variant="secondary"
            label={t.phone.openFile}
            disabled={fileOpening.state.kind === 'opening'}
            onPress={openFile}
          />
        )}
        <Button
          testID="create-vault"
          variant="secondary"
          label={t.phone.create}
          onPress={() => router.push(paths.create())}
        />
      </View>
      {fileOpening?.state.kind === 'opening' && <Busy label={t.phone.openFile} />}
      {fileOpening?.state.kind === 'failed' && (
        <Notice
          testID="open-file-failed"
          tone="error"
          message={adoptFailureText(cloudTexts, fileOpening.state.failure)}
        />
      )}
      <ThemeChoice />
    </Screen>
  );
});

const styles = StyleSheet.create({
  heading: { fontSize: TEXT_SIZE.heading, fontWeight: '500' },
  actions: { gap: GAP },
  footer: { fontSize: TEXT_SIZE.caption, marginTop: 'auto' },
});
