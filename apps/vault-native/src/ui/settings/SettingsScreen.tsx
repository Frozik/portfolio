import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useAppModel } from '../app-model';
import { DataSection } from '../data/DataSection';
import { GAP, GUTTER, TEXT_SIZE } from '../kit/metrics';
import { useCloudTexts, useDataTexts, useSettingsTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';
import { BiometricSection } from './BiometricSection';
import { ChangePasswordSection } from './ChangePasswordSection';
import { CloudSection } from './CloudSection';
import { DeviceLockSection } from './DeviceLockSection';
import { ForgetVaultSection } from './ForgetVaultSection';
import { QuickUnlockSection } from './QuickUnlockSection';
import { RecoveryKeySection } from './RecoveryKeySection';
import { RotateKeySection } from './RotateKeySection';
import { ScreenshotsSection } from './ScreenshotsSection';
import { SettingsGroup } from './SettingsGroup';
import { ThemeChoice } from './ThemeChoice';
import { VaultTitleSection } from './VaultTitleSection';

/** Every setting of the open vault on this phone, one column a thumb scrolls through. */
export const SettingsScreen = observer(function SettingsScreen() {
  const { version } = useAppModel();
  const session = useSession();
  const palette = usePalette();
  const t = useSettingsTexts();
  const cloudTexts = useCloudTexts();
  const dataTexts = useDataTexts();
  const [deviceUnlock] = useState(() => session.flows.deviceUnlockOf());
  return (
    <ScrollView
      testID="settings"
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <SettingsGroup title={t.security}>
        <ThemeChoice />
        <DeviceLockSection deviceSettings={session.deviceSettings} />
        <QuickUnlockSection />
        {deviceUnlock !== null && <BiometricSection setup={deviceUnlock} />}
        <ScreenshotsSection deviceSettings={session.deviceSettings} />
      </SettingsGroup>
      <SettingsGroup title={t.vault}>
        <VaultTitleSection />
        <ChangePasswordSection />
        <RecoveryKeySection />
        <RotateKeySection />
        <ForgetVaultSection />
      </SettingsGroup>
      <SettingsGroup title={cloudTexts.section.title}>
        <CloudSection />
      </SettingsGroup>
      <SettingsGroup title={dataTexts.title}>
        <DataSection />
      </SettingsGroup>
      <SettingsGroup title={t.about}>
        <Text testID="settings-version" style={[styles.text, { color: palette.fgDim }]}>
          Ciphra Vault {version}
        </Text>
        <Text style={[styles.text, { color: palette.fgDim }]}>{t.credits}</Text>
        {t.creditsPhone.map(credit => (
          <Text key={credit} style={[styles.small, { color: palette.fgFaint }]}>
            {credit}
          </Text>
        ))}
      </SettingsGroup>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  page: { gap: GAP * 2, padding: GUTTER },
  text: { fontSize: TEXT_SIZE.small },
  small: { fontSize: TEXT_SIZE.caption },
});
