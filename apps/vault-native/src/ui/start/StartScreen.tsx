import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isNil } from 'lodash-es';

import { launchVaultOf } from '@frozik/vault-app/device/domain/launch-vault';
import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';
import { adoptFailureText } from '@frozik/vault-app/texts/cloud/cloud-wording';

import { useAppModel } from '../app-model';
import { BottomSheet } from '../kit/BottomSheet';
import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { IconButton } from '../kit/IconButton';
import { GAP, GUTTER, RADIUS, TEXT_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { Screen } from '../kit/Screen';
import { ThemeChoice } from '../settings/ThemeChoice';
import { useCloudTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { UpdateLink } from '../UpdateLink';
import { useTakeInFile } from './useTakeInFile';
import { VaultList } from './VaultList';

const PRODUCT_NAME = 'Ciphra Vault';
const paths = createVaultPaths('');

/** The first screen: the vaults this phone knows, and the ways to get one. */
export const StartScreen = observer(function StartScreen() {
  const { app, updates, version, takeLaunch } = useAppModel();
  const cloudTexts = useCloudTexts();
  const { fileOpening } = app;
  const takeInFile = useTakeInFile();
  const openFile = (): void => {
    void fileOpening?.pick().then(file => {
      if (!isNil(file)) {
        takeInFile(file);
      }
    });
  };
  const router = useRouter();
  const palette = usePalette();
  const [themeOpen, setThemeOpen] = useState(false);
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
      titleBadge={
        <Text
          testID="app-version"
          style={[styles.version, { color: palette.fgDim, backgroundColor: palette.bgElevated }]}
        >
          {version}
        </Text>
      }
      titleEnd={<UpdateLink watch={updates} />}
      footer={
        <View style={styles.footer}>
          <IconButton
            testID="start-appearance"
            icon="settings"
            label={t.appearance.label}
            onPress={() => setThemeOpen(true)}
          />
        </View>
      }
    >
      <Text accessibilityRole="header" style={[styles.heading, { color: palette.fg }]}>
        {t.deviceVaults.title}
      </Text>
      <VaultList />
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            testID="open-from-cloud"
            variant="secondary"
            iconOnly
            icon="cloud-download"
            label={t.phone.openFromCloud}
            onPress={() => router.push(paths.openFromCloud())}
          />
        </View>
        {!isNil(fileOpening) && (
          <View style={styles.action}>
            <Button
              testID="open-file"
              variant="secondary"
              iconOnly
              icon="folder-open"
              label={t.phone.openFile}
              disabled={fileOpening.state.kind === 'opening'}
              onPress={openFile}
            />
          </View>
        )}
        <View style={styles.action}>
          <Button
            testID="create-vault"
            iconOnly
            icon="add"
            label={t.phone.create}
            onPress={() => router.push(paths.create())}
          />
        </View>
      </View>
      {fileOpening?.state.kind === 'opening' && <Busy label={t.phone.openFile} />}
      {fileOpening?.state.kind === 'failed' && (
        <Notice
          testID="open-file-failed"
          tone="error"
          message={adoptFailureText(cloudTexts, fileOpening.state.failure)}
        />
      )}
      <BottomSheet
        testID="start-appearance-sheet"
        open={themeOpen}
        title={t.appearance.label}
        onClose={() => setThemeOpen(false)}
      >
        <View style={styles.sheetBody}>
          <ThemeChoice />
        </View>
      </BottomSheet>
    </Screen>
  );
});

const styles = StyleSheet.create({
  heading: { fontSize: TEXT_SIZE.heading, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: GAP },
  action: { flex: 1 },
  version: {
    fontSize: TEXT_SIZE.caption,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  sheetBody: { paddingHorizontal: GUTTER },
  footer: { marginTop: 'auto', alignItems: 'flex-end' },
});
