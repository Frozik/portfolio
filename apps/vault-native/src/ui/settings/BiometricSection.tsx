import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, Text } from 'react-native';

import type { DeviceUnlockSetup } from '@frozik/vault-app/keys/application/DeviceUnlockSetup';

import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { TEXT_SIZE } from '../kit/metrics';
import { TextField } from '../kit/TextField';
import { useKeysTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const ENROL_INTENT = 'android.settings.BIOMETRIC_ENROLL';
/** Phones before Android 11 have no enrolment screen of their own: their security settings hold it. */
const SECURITY_INTENT = 'android.settings.SECURITY_SETTINGS';

function openEnrolment(): void {
  void Linking.sendIntent(ENROL_INTENT).catch(() => Linking.sendIntent(SECURITY_INTENT));
}

/**
 * Biometric unlock of this vault on this phone: what the sensor allows, on or off. With no
 * fingerprint it leads to the phone's settings, and looks at the sensor again on coming back.
 */
export const BiometricSection = observer(function BiometricSection({
  setup,
}: {
  readonly setup: DeviceUnlockSetup;
}) {
  const palette = usePalette();
  const t = useKeysTexts().biometric;
  const [password, setPassword] = useState('');
  useEffect(() => {
    void setup.check();
    const watch = AppState.addEventListener('change', next => {
      if (next === 'active') {
        void setup.check();
      }
    });
    return () => watch.remove();
  }, [setup]);
  const { state } = setup;
  return (
    <>
      <Text style={[styles.label, { color: palette.fgDim }]}>{t.title}</Text>
      {state.kind === 'checking' && <Busy label={t.title} />}
      {state.kind === 'unavailable' && (
        <Text testID="biometric-class" style={[styles.text, { color: palette.fgDim }]}>
          {t.classes[state.biometricClass]}
        </Text>
      )}
      {state.kind === 'unavailable' && (
        <Button
          testID="biometric-enrol"
          variant="secondary"
          icon="fingerprint"
          label={t.enrol}
          onPress={openEnrolment}
        />
      )}
      {state.kind === 'on' && (
        <>
          <Text testID="biometric-on" style={[styles.text, { color: palette.fgDim }]}>
            {t.on}
          </Text>
          <Button
            testID="biometric-switch-off"
            variant="secondary"
            label={t.switchOff}
            onPress={() => void setup.switchOff()}
          />
        </>
      )}
      {(state.kind === 'off' || state.kind === 'failed') && (
        <>
          <Text style={[styles.text, { color: palette.fgDim }]}>{t.intro}</Text>
          <TextField label={t.password} value={password} onChangeText={setPassword} secret />
          <Text style={[styles.text, { color: palette.fgFaint }]}>{t.passwordHint}</Text>
          {state.kind === 'failed' && (
            <Text accessibilityRole="alert" style={[styles.text, { color: palette.danger }]}>
              {t.failures[state.failure]}
            </Text>
          )}
          <Button
            testID="biometric-switch-on"
            label={t.switchOn}
            disabled={password === ''}
            onPress={() => {
              void setup.switchOn(password);
              setPassword('');
            }}
          />
        </>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  label: { fontSize: TEXT_SIZE.small },
  text: { fontSize: TEXT_SIZE.small },
});
