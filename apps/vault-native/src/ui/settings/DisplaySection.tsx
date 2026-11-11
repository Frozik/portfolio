import { observer } from 'mobx-react-lite';

import type { DeviceSettingsModel } from '@frozik/vault-app/device/application/DeviceSettingsModel';

import { Checkbox } from '../kit/Checkbox';
import { useSettingsTexts } from '../texts';

/** What the open vault's screens show beyond the cards: the list's strips, the Audit tab's count. */
export const DisplaySection = observer(function DisplaySection({
  deviceSettings,
}: {
  readonly deviceSettings: DeviceSettingsModel;
}) {
  const t = useSettingsTexts().display;
  const { showRecent, showFavorites, showAuditCount } = deviceSettings.settings;
  return (
    <>
      <Checkbox
        testID="show-recent"
        label={t.recent}
        checked={showRecent}
        onChange={value => deviceSettings.update({ showRecent: value })}
      />
      <Checkbox
        testID="show-favorites"
        label={t.favorites}
        checked={showFavorites}
        onChange={value => deviceSettings.update({ showFavorites: value })}
      />
      <Checkbox
        testID="show-audit-count"
        label={t.auditCount}
        checked={showAuditCount}
        onChange={value => deviceSettings.update({ showAuditCount: value })}
      />
    </>
  );
});
