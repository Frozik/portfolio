import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DeviceUnlockSetup } from '@frozik/vault-app/keys/application/DeviceUnlockSetup';

import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { GAP, RADIUS, TEXT_SIZE } from '../kit/metrics';
import { TextField } from '../kit/TextField';
import { useKeysTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

/**
 * Asked once after a master-password unlock on a phone with a strong sensor, as a strip that
 * leaves the page usable; the password once more is asked in a dialog, since an open vault's key
 * cannot be read out.
 */
export const BiometricOffer = observer(function BiometricOffer({
  setup,
}: {
  readonly setup: DeviceUnlockSetup;
}) {
  const palette = usePalette();
  const t = useKeysTexts().biometric;
  const [dismissed, setDismissed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  useEffect(() => {
    void setup.check();
  }, [setup]);
  const { state } = setup;
  if (
    dismissed ||
    state.kind === 'on' ||
    state.kind === 'checking' ||
    state.kind === 'unavailable'
  ) {
    return null;
  }
  const switchOn = (): void => {
    if (password === '') {
      return;
    }
    void setup.switchOn(password);
    setPassword('');
  };
  return (
    <View
      testID="biometric-offer"
      style={[styles.banner, { borderColor: palette.line, backgroundColor: palette.bgCard }]}
    >
      <Text style={[styles.title, { color: palette.fg }]}>{t.offer}</Text>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            testID="biometric-offer-open"
            label={t.switchOn}
            onPress={() => setAsking(true)}
          />
        </View>
        <View style={styles.action}>
          <Button variant="secondary" label={t.notNow} onPress={() => setDismissed(true)} />
        </View>
      </View>
      <Dialog open={asking} title={t.title} onClose={() => setAsking(false)}>
        <Text style={[styles.text, { color: palette.fgDim }]}>{t.intro}</Text>
        <TextField
          testID="biometric-password"
          label={t.password}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={switchOn}
          secret
        />
        <Text style={[styles.text, { color: palette.fgFaint }]}>{t.passwordHint}</Text>
        {state.kind === 'failed' && (
          <Text
            testID="biometric-failure"
            accessibilityRole="alert"
            style={[styles.text, { color: palette.danger }]}
          >
            {t.failures[state.failure]}
          </Text>
        )}
        <Button
          testID="biometric-switch-on"
          label={t.switchOn}
          disabled={password === ''}
          onPress={switchOn}
        />
      </Dialog>
    </View>
  );
});

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderRadius: RADIUS, padding: 12, gap: 8 },
  title: { fontSize: TEXT_SIZE.body, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: GAP },
  action: { flex: 1 },
  text: { fontSize: TEXT_SIZE.small },
});
