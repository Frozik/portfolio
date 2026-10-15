import { Checkbox } from '@frozik/components/components/RichEditor/Checkbox';
import { Select } from '@frozik/components/components/select/Select';
import type { Milliseconds } from '@frozik/utils/date/types';
import { observer } from 'mobx-react-lite';

import type { DeviceSettingsModel } from '@frozik/vault-app/device/application/DeviceSettingsModel';
import {
  CLIPBOARD_CLEAR_CHOICES,
  HIDDEN_LOCK_CHOICES,
  IDLE_LOCK_CHOICES,
} from '@frozik/vault-app/device/domain/device-settings';
import { durationLabel } from '@frozik/vault-app/texts/device/duration-wording';
import { VaultField } from '../form/VaultField';
import { LANGUAGE } from '../texts/language';
import { settingsT } from '../texts/settings';

const NEVER = 'never';

function hiddenKey(ms: Milliseconds | null): string {
  return ms === null ? NEVER : String(ms);
}

function choiceOptions(choices: readonly (Milliseconds | null)[]) {
  return choices.map(ms => ({ value: hiddenKey(ms), label: durationLabel(settingsT, ms) }));
}

/** This device's timeouts for the vault — idle, out of sight, the clipboard — and its site icons. */
export const DeviceLockSection = observer(
  ({ deviceSettings }: { readonly deviceSettings: DeviceSettingsModel }) => {
    const t = settingsT;
    const { settings } = deviceSettings;
    return (
      <>
        <VaultField label={t.idleLock}>
          {() => (
            <Select
              aria-label={t.idleLock}
              options={choiceOptions(IDLE_LOCK_CHOICES)}
              value={String(settings.lock.idle)}
              onValueChange={value =>
                deviceSettings.update({
                  lock: { ...settings.lock, idle: Number(value) as Milliseconds },
                })
              }
              locale={LANGUAGE}
            />
          )}
        </VaultField>
        <VaultField label={t.hiddenLock}>
          {() => (
            <Select
              aria-label={t.hiddenLock}
              options={choiceOptions(HIDDEN_LOCK_CHOICES)}
              value={hiddenKey(settings.lock.hidden)}
              onValueChange={value =>
                deviceSettings.update({
                  lock: {
                    ...settings.lock,
                    hidden: value === NEVER ? null : (Number(value) as Milliseconds),
                  },
                })
              }
              locale={LANGUAGE}
            />
          )}
        </VaultField>
        <VaultField label={t.clipboardClear} hint={t.clipboardNote}>
          {describedBy => (
            <Select
              aria-label={t.clipboardClear}
              aria-describedby={describedBy}
              options={choiceOptions(CLIPBOARD_CLEAR_CHOICES)}
              value={String(settings.clipboardClearMs)}
              onValueChange={value =>
                deviceSettings.update({ clipboardClearMs: Number(value) as Milliseconds })
              }
              locale={LANGUAGE}
            />
          )}
        </VaultField>
        <VaultField label={t.siteIcons} hint={t.siteIconsNote}>
          {() => (
            <Checkbox
              checked={settings.loadSiteIcons}
              onCheckedChange={loadSiteIcons => deviceSettings.update({ loadSiteIcons })}
            >
              {t.siteIconsToggle}
            </Checkbox>
          )}
        </VaultField>
      </>
    );
  }
);
