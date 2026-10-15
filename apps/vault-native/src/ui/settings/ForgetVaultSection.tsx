import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';

import { useAppModel } from '../app-model';
import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { TEXT_SIZE } from '../kit/metrics';
import { useSettingsTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const paths = createVaultPaths('');

/** This vault off this phone: its copy and everything the phone kept of it. */
export function ForgetVaultSection() {
  const { app } = useAppModel();
  const router = useRouter();
  const palette = usePalette();
  const t = useSettingsTexts();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Button
        testID="forget-vault"
        variant="danger"
        label={t.forget}
        onPress={() => setConfirming(true)}
      />
      {confirming && (
        <Dialog open title={t.forgetTitle} onClose={() => setConfirming(false)}>
          <Text style={[styles.text, { color: palette.fgDim }]}>{t.forgetMessage}</Text>
          <Button
            testID="confirm-forget"
            variant="danger"
            label={t.forgetConfirm}
            onPress={() => {
              router.dismissTo(paths.start());
              void app.forgetVault();
            }}
          />
          <Button variant="secondary" label={t.cancel} onPress={() => setConfirming(false)} />
        </Dialog>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: TEXT_SIZE.small },
});
