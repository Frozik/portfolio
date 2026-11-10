import { useRouter } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';
import { View } from 'react-native';

import type { TPermission } from '../../contexts/device/domain/ports/permissions';
import type { TLanguageChoice, TThemeChoice } from '../../contexts/device/domain/preferences';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { ICON_SIZE } from '../kit/metrics';
import { Row } from '../kit/Row';
import { Screen } from '../kit/Screen';
import { Section } from '../kit/Section';
import { SegmentedControl } from '../kit/SegmentedControl';
import { SelectRow } from '../kit/SelectRow';
import { ToggleRow } from '../kit/ToggleRow';
import { usePalette } from '../theme/AppTheme';
import { SyncSection } from './SyncSection';

const PERMISSIONS: readonly TPermission[] = [
  'contacts',
  'call-log',
  'calendar',
  'notifications',
  'phone-state',
  'sms',
];
const THEMES: readonly TThemeChoice[] = ['system', 'light', 'dark'];

/** The phone's language, or one the user fixed. */
type TLanguageOption = 'system' | Extract<TLanguageChoice, { kind: 'fixed' }>['language'];

/** A short list: screening and permissions, language, theme, calendars, diagnostics. */
export const SettingsScreen = observer(function SettingsScreen() {
  const app = useApp();
  const texts = useTexts();
  const palette = usePalette();
  const router = useRouter();
  const { device } = app;
  const { conflicts } = app.books;
  const themeLabel = (theme: TThemeChoice) =>
    theme === 'system'
      ? texts.settings.themeSystem
      : theme === 'light'
        ? texts.settings.themeLight
        : texts.settings.themeDark;
  return (
    <Screen testID="settings-screen" title={texts.settings.title}>
      <Section title={texts.settings.screening}>
        <Row
          testID="settings-role"
          title={texts.settings.role}
          subtitle={device.holdsRole ? texts.settings.roleOn : texts.settings.roleOff}
          onPress={device.holdsRole ? undefined : () => void device.requestRole()}
        />
        {PERMISSIONS.filter(permission => permission !== 'sms' || app.smsReply).map(permission => (
          <Row
            key={permission}
            testID={`settings-permission-${permission}`}
            title={texts.settings.permission[permission]}
            subtitle={
              device.permissions[permission] === 'granted'
                ? texts.settings.granted
                : texts.settings.grant
            }
            trailing={
              device.permissions[permission] === 'granted' ? undefined : (
                <View
                  testID={`settings-permission-${permission}-attention`}
                  accessible
                  accessibilityLabel={texts.settings.grant}
                >
                  <TriangleAlert color={palette.caution} size={ICON_SIZE} />
                </View>
              )
            }
            onPress={
              device.permissions[permission] === 'granted'
                ? undefined
                : () => void device.request(permission).then(() => app.foreground())
            }
          />
        ))}
      </Section>
      <SyncSection />
      <Section>
        <SelectRow<TLanguageOption>
          testID="settings-language"
          title={texts.settings.language}
          options={[
            { value: 'system', label: texts.settings.languageSystem, testID: 'language-system' },
            { value: 'ru', label: 'Русский', testID: 'language-ru' },
            { value: 'en', label: 'English', testID: 'language-en' },
          ]}
          value={
            device.languageChoice.kind === 'system' ? 'system' : device.languageChoice.language
          }
          onChange={language =>
            device.setLanguage(
              language === 'system' ? { kind: 'system' } : { kind: 'fixed', language }
            )
          }
        />
      </Section>
      <Section title={texts.settings.theme}>
        <SegmentedControl
          segments={THEMES.map(theme => ({
            value: theme,
            label: themeLabel(theme),
            testID: `theme-${theme}`,
          }))}
          value={device.preferences.theme}
          onChange={theme => device.setTheme(theme)}
        />
      </Section>
      <Section>
        <ToggleRow
          testID="settings-ask-where-to"
          title={texts.settings.askWhereTo}
          value={device.preferences.askWhereToAfterCall}
          onChange={ask => device.setAskWhereTo(ask)}
        />
        <Row
          testID="settings-calendars"
          title={texts.settings.calendars}
          onPress={() => router.push('/calendars')}
        />
        <Row
          testID="settings-conflicts"
          title={texts.conflict.title}
          subtitle={
            conflicts.length === 0
              ? texts.conflict.noneShort
              : texts.conflict.count(conflicts.length)
          }
          trailing={
            conflicts.length === 0 ? undefined : (
              <View
                testID="settings-conflicts-attention"
                accessible
                accessibilityLabel={texts.conflict.count(conflicts.length)}
              >
                <TriangleAlert color={palette.caution} size={ICON_SIZE} />
              </View>
            )
          }
          onPress={() => router.push('/conflicts')}
        />
        <Row
          testID="settings-diagnostics"
          title={`${texts.settings.diagnostics}${app.diagnostics.hasRecentErrors ? ' ●' : ''}`}
          onPress={() => router.push('/diagnostics')}
        />
      </Section>
    </Screen>
  );
});
