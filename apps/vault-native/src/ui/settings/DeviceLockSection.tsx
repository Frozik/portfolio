import type { Milliseconds } from '@frozik/utils/date/types';
import { observer } from 'mobx-react-lite';
import { StyleSheet, Text } from 'react-native';

import type { DeviceSettingsModel } from '@frozik/vault-app/device/application/DeviceSettingsModel';
import {
  CLIPBOARD_CLEAR_CHOICES,
  HIDDEN_LOCK_CHOICES,
  IDLE_LOCK_CHOICES,
} from '@frozik/vault-app/device/domain/device-settings';
import { durationLabel } from '@frozik/vault-app/texts/device/duration-wording';

import { Checkbox } from '../kit/Checkbox';
import { TEXT_SIZE } from '../kit/metrics';
import { Select } from '../kit/Select';
import { useSettingsTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const NEVER = 'never';

function keyOf(ms: Milliseconds | null): string {
  return ms === null ? NEVER : String(ms);
}

/** This device's timeouts for the vault (idle, in the background, the clipboard) and whether it asks for site icons. */
export const DeviceLockSection = observer(function DeviceLockSection({
  deviceSettings,
}: {
  readonly deviceSettings: DeviceSettingsModel;
}) {
  const t = useSettingsTexts();
  const palette = usePalette();
  const { settings } = deviceSettings;
  const optionsOf = (choices: readonly (Milliseconds | null)[]) =>
    choices.map(ms => ({ value: keyOf(ms), label: durationLabel(t, ms) }));
  return (
    <>
      <Select
        testID="idle-lock"
        label={t.idleLock}
        value={keyOf(settings.lock.idle)}
        options={optionsOf(IDLE_LOCK_CHOICES)}
        onChange={value =>
          deviceSettings.update({ lock: { ...settings.lock, idle: Number(value) as Milliseconds } })
        }
      />
      <Select
        testID="hidden-lock"
        label={t.hiddenLockPhone}
        value={keyOf(settings.lock.hidden)}
        options={optionsOf(HIDDEN_LOCK_CHOICES)}
        onChange={value =>
          deviceSettings.update({
            lock: {
              ...settings.lock,
              hidden: value === NEVER ? null : (Number(value) as Milliseconds),
            },
          })
        }
      />
      <Select
        testID="clipboard-clear"
        label={t.clipboardClear}
        value={keyOf(settings.clipboardClearMs)}
        options={optionsOf(CLIPBOARD_CLEAR_CHOICES)}
        onChange={value =>
          deviceSettings.update({ clipboardClearMs: Number(value) as Milliseconds })
        }
      />
      <Checkbox
        testID="load-site-icons"
        label={t.siteIconsToggle}
        checked={settings.loadSiteIcons}
        onChange={loadSiteIcons => deviceSettings.update({ loadSiteIcons })}
      />
      <Text style={[styles.note, { color: palette.fgFaint }]}>{t.siteIconsNote}</Text>
    </>
  );
});

const styles = StyleSheet.create({
  note: { fontSize: TEXT_SIZE.small },
});
