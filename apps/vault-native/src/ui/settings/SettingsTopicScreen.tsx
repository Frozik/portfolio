import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { assertNever } from '@frozik/utils/assert/assertNever';

import { useAppModel } from '../app-model';
import { DataSection } from '../data/DataSection';
import { ICON_BUTTON_INSET, IconButton } from '../kit/IconButton';
import { GAP, GUTTER, TEXT_SIZE } from '../kit/metrics';
import { useSettingsTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useOpenLink } from '../useOpenLink';
import { useSession } from '../vault/session-context';
import { BackupSection } from './BackupSection';
import { BiometricSection } from './BiometricSection';
import { ChangePasswordSection } from './ChangePasswordSection';
import { CloudSection } from './CloudSection';
import { DeviceLockSection } from './DeviceLockSection';
import { DiagnosticsSection } from './DiagnosticsSection';
import { DisplaySection } from './DisplaySection';
import { ForgetVaultSection } from './ForgetVaultSection';
import { LabelsSection } from './LabelsSection';
import { QuickUnlockSection } from './QuickUnlockSection';
import { RecoveryKeySection } from './RecoveryKeySection';
import { RotateKeySection } from './RotateKeySection';
import { ScreenshotsSection } from './ScreenshotsSection';
import type { TSettingsTopic } from './settings-topics';
import { ThemeChoice } from './ThemeChoice';
import { VaultTitleSection } from './VaultTitleSection';

const HOMEPAGE = 'https://frozik.github.io/portfolio/';

const About = observer(function About() {
  const { version } = useAppModel();
  const palette = usePalette();
  const t = useSettingsTexts();
  const openLink = useOpenLink();
  return (
    <>
      <Text testID="settings-version" style={[styles.text, { color: palette.fgDim }]}>
        Ciphra Vault {version}
      </Text>
      <Text style={[styles.text, { color: palette.fgDim }]}>{t.author}</Text>
      <Text testID="settings-author" style={[styles.text, { color: palette.fg }]}>
        {t.authorName}
      </Text>
      <Pressable
        testID="settings-homepage"
        accessibilityRole="link"
        hitSlop={GAP}
        onPress={() => openLink(HOMEPAGE)}
      >
        <Text style={[styles.text, styles.link, { color: palette.accent }]}>{HOMEPAGE}</Text>
      </Pressable>
      <Text style={[styles.text, { color: palette.fgDim }]}>{t.credits}</Text>
      {t.creditsPhone.map(credit => (
        <Text key={credit} style={[styles.small, { color: palette.fgFaint }]}>
          {credit}
        </Text>
      ))}
    </>
  );
});

const Security = observer(function Security() {
  const session = useSession();
  const [deviceUnlock] = useState(() => session.flows.deviceUnlockOf());
  return (
    <>
      <DeviceLockSection deviceSettings={session.deviceSettings} />
      <QuickUnlockSection />
      {deviceUnlock !== null && <BiometricSection setup={deviceUnlock} />}
      <ScreenshotsSection deviceSettings={session.deviceSettings} />
    </>
  );
});

function TopicContent({ topic }: { readonly topic: TSettingsTopic }) {
  const session = useSession();
  switch (topic) {
    case 'security':
      return <Security />;
    case 'display':
      return (
        <>
          <ThemeChoice />
          <DisplaySection deviceSettings={session.deviceSettings} />
        </>
      );
    case 'labels':
      return <LabelsSection />;
    case 'vault':
      return (
        <>
          <VaultTitleSection />
          <ChangePasswordSection />
          <RecoveryKeySection />
          <RotateKeySection />
          <ForgetVaultSection />
        </>
      );
    case 'cloud':
      return <CloudSection />;
    case 'data':
      return <DataSection />;
    case 'backup':
      return <BackupSection />;
    case 'diagnostics':
      return <DiagnosticsSection />;
    case 'about':
      return <About />;
    default:
      return assertNever(topic);
  }
}

/** One topic of the settings on a page of its own, the way back and its name on top. */
export function SettingsTopicScreen({ topic }: { readonly topic: TSettingsTopic }) {
  const router = useRouter();
  const palette = usePalette();
  const t = useSettingsTexts();
  return (
    <ScrollView
      testID={`settings-${topic}`}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <IconButton
          testID="settings-back"
          icon="arrow-back"
          label={t.title}
          role="link"
          onPress={() => router.back()}
        />
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[styles.title, { color: palette.fg }]}
        >
          {t.topics[topic].title}
        </Text>
      </View>
      <TopicContent topic={topic} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  link: { textDecorationLine: 'underline' },
  page: { gap: GAP, padding: GUTTER },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -ICON_BUTTON_INSET },
  title: { flexShrink: 1, fontSize: TEXT_SIZE.heading, fontWeight: '600' },
  text: { fontSize: TEXT_SIZE.small },
  small: { fontSize: TEXT_SIZE.caption },
});
