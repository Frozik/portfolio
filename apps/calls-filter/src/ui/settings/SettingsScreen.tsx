import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';

import type { TPermission } from '../../contexts/device/domain/ports/permissions';
import type { TThemeChoice } from '../../contexts/device/domain/preferences';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { Chip } from '../kit/Chip';
import { Row } from '../kit/Row';
import { Screen } from '../kit/Screen';
import { Section } from '../kit/Section';
import { ToggleRow } from '../kit/ToggleRow';
import { Wrap } from '../kit/Wrap';
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

/** A short list: screening and permissions, language, theme, calendars, diagnostics. */
export const SettingsScreen = observer(function SettingsScreen() {
  const app = useApp();
  const texts = useTexts();
  const router = useRouter();
  const { device } = app;
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
            onPress={
              device.permissions[permission] === 'granted'
                ? undefined
                : () => void device.request(permission).then(() => app.foreground())
            }
          />
        ))}
      </Section>
      <SyncSection />
      <Section title={texts.settings.language}>
        <Wrap>
          <Chip
            testID="language-system"
            label={texts.settings.languageSystem}
            selected={device.languageChoice.kind === 'system'}
            onPress={() => device.setLanguage({ kind: 'system' })}
          />
          <Chip
            testID="language-ru"
            label="Русский"
            selected={
              device.languageChoice.kind === 'fixed' && device.languageChoice.language === 'ru'
            }
            onPress={() => device.setLanguage({ kind: 'fixed', language: 'ru' })}
          />
          <Chip
            testID="language-en"
            label="English"
            selected={
              device.languageChoice.kind === 'fixed' && device.languageChoice.language === 'en'
            }
            onPress={() => device.setLanguage({ kind: 'fixed', language: 'en' })}
          />
        </Wrap>
      </Section>
      <Section title={texts.settings.theme}>
        <Wrap>
          {THEMES.map(theme => (
            <Chip
              key={theme}
              testID={`theme-${theme}`}
              label={themeLabel(theme)}
              selected={device.preferences.theme === theme}
              onPress={() => device.setTheme(theme)}
            />
          ))}
        </Wrap>
      </Section>
      <Section>
        <ToggleRow
          testID="settings-ask-where-to"
          title={texts.settings.askWhereTo}
          value={device.preferences.askWhereToAfterCall}
          onChange={ask => device.setAskWhereTo(ask)}
        />
        <Row
          testID="settings-journal-days"
          title={texts.settings.journalDays(device.preferences.journalDays)}
        />
        <Row
          testID="settings-calendars"
          title={texts.settings.calendars}
          onPress={() => router.push('/calendars')}
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
