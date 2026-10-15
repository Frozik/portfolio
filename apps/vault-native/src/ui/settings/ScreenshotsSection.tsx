import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { DeviceSettingsModel } from '@frozik/vault-app/device/application/DeviceSettingsModel';

import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { TEXT_SIZE } from '../kit/metrics';
import { useSettingsTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

/** Screenshots of the open vault: blocked until the user confirms what allowing them means. */
export const ScreenshotsSection = observer(function ScreenshotsSection({
  deviceSettings,
}: {
  readonly deviceSettings: DeviceSettingsModel;
}) {
  const palette = usePalette();
  const t = useSettingsTexts().screenshots;
  const [confirming, setConfirming] = useState(false);
  const allowed = deviceSettings.settings.allowScreenshots;
  return (
    <>
      <Text style={[styles.label, { color: palette.fgDim }]}>{t.label}</Text>
      <Text
        testID="screenshots-state"
        style={[styles.state, { color: allowed ? palette.caution : palette.fgDim }]}
      >
        {allowed ? t.allowed : t.blocked}
      </Text>
      {allowed ? (
        <Button
          testID="block-screenshots"
          variant="secondary"
          label={t.block}
          onPress={() => deviceSettings.update({ allowScreenshots: false })}
        />
      ) : (
        <Button
          testID="allow-screenshots"
          variant="secondary"
          label={t.allow}
          onPress={() => setConfirming(true)}
        />
      )}
      {confirming && (
        <Dialog open title={t.confirmTitle} onClose={() => setConfirming(false)}>
          <Text style={[styles.state, { color: palette.fgDim }]}>{t.confirmMessage}</Text>
          <Button
            testID="confirm-screenshots"
            variant="danger"
            label={t.confirm}
            onPress={() => {
              deviceSettings.update({ allowScreenshots: true });
              setConfirming(false);
            }}
          />
          <Button variant="secondary" label={t.block} onPress={() => setConfirming(false)} />
        </Dialog>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  label: { fontSize: TEXT_SIZE.small },
  state: { fontSize: TEXT_SIZE.small },
});
