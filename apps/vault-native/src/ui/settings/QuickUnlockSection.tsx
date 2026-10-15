import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { QuickUnlockSetup } from '@frozik/vault-app/keys/application/QuickUnlockSetup';
import { QUICK_LIFETIME_CHOICES } from '@frozik/vault-app/keys/domain/quick-code';
import type { TQuickUnlockKind } from '@frozik/vault-app/keys/domain/quick-code';

import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { Checkbox } from '../kit/Checkbox';
import { TEXT_SIZE } from '../kit/metrics';
import { Select } from '../kit/Select';
import { TextField } from '../kit/TextField';
import { useKeysTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { PatternPad } from '../unlock/PatternPad';
import { useSession } from '../vault/session-context';

const KINDS: readonly TQuickUnlockKind[] = ['pin', 'pattern', 'first-four', 'last-four'];
const HOUR_MS = 3_600_000;

/** The setup's current step: the password, the kind, the code twice. */
const SetupSteps = observer(function SetupSteps({ setup }: { readonly setup: QuickUnlockSetup }) {
  const palette = usePalette();
  const keysTexts = useKeysTexts();
  const vaultTexts = useVaultTexts();
  const t = keysTexts.quick;
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const { step } = setup;
  switch (step.kind) {
    case 'password':
      return (
        <>
          <TextField
            testID="quick-master"
            label={t.password}
            value={password}
            onChangeText={setPassword}
            secret
          />
          <Text style={[styles.text, { color: palette.fgFaint }]}>{t.passwordHint}</Text>
          {!isNil(step.failure) && (
            <Text style={[styles.text, { color: palette.danger }]}>
              {vaultTexts.unlock.failures[step.failure]}
            </Text>
          )}
          <Button
            testID="quick-check"
            label={t.check}
            disabled={password === ''}
            onPress={() => {
              void setup.checkPassword(password);
              setPassword('');
            }}
          />
        </>
      );
    case 'checking':
      return <Busy label={t.checking} />;
    case 'choose':
      return (
        <>
          {KINDS.filter(
            kind => setup.masterCharactersOffered || (kind !== 'first-four' && kind !== 'last-four')
          ).map(kind => (
            <Button
              key={kind}
              testID={`quick-kind-${kind}`}
              variant="secondary"
              label={t.kinds[kind]}
              onPress={() => setup.choose(kind)}
            />
          ))}
          {!isNil(step.problem) && (
            <Text style={[styles.text, { color: palette.danger }]}>{t.problems[step.problem]}</Text>
          )}
        </>
      );
    case 'enter':
    case 'confirm': {
      const confirming = step.kind === 'confirm';
      const submit = (entered: string | readonly number[]): void =>
        confirming ? setup.confirm(entered) : setup.enter(entered);
      return (
        <>
          {step.method === 'pin' ? (
            <>
              <TextField
                testID="quick-pin"
                label={confirming ? t.confirmPin : t.enterPin}
                value={pin}
                onChangeText={setPin}
                kind="number"
                secret
              />
              <Button
                testID="quick-next"
                label={t.next}
                disabled={pin === ''}
                onPress={() => {
                  submit(pin);
                  setPin('');
                }}
              />
            </>
          ) : (
            <>
              <Text style={[styles.text, { color: palette.fgDim }]}>
                {confirming ? t.confirmPattern : t.drawPattern}
              </Text>
              <PatternPad hideLine={setup.hideLine} onComplete={submit} />
            </>
          )}
          {step.kind === 'enter' && !isNil(step.problem) && (
            <Text accessibilityRole="alert" style={[styles.text, { color: palette.danger }]}>
              {t.problems[step.problem]}
            </Text>
          )}
        </>
      );
    }
    case 'done':
      return (
        <Text testID="quick-done" style={[styles.text, { color: palette.positive }]}>
          {t.done}
        </Text>
      );
    default:
      return assertNever(step);
  }
});

/** Quick unlock of the open vault on this phone: off, or a code of one kind, its lifetime. */
export const QuickUnlockSection = observer(function QuickUnlockSection() {
  const session = useSession();
  const palette = usePalette();
  const t = useKeysTexts().quick;
  const [setup, setSetup] = useState<QuickUnlockSetup | null>(null);
  useEffect(() => () => setup?.cancel(), [setup]);
  const current = session.deviceSettings.settings.quickUnlock;
  return (
    <>
      <Text style={[styles.label, { color: palette.fgDim }]}>{t.title}</Text>
      <Text testID="quick-state" style={[styles.text, { color: palette.fgDim }]}>
        {isNil(current) ? t.off : t.on[current.kind]}
      </Text>
      {isNil(setup) ? (
        <Button
          testID="quick-set-up"
          variant="secondary"
          label={isNil(current) ? t.setUp : t.change}
          onPress={() => setSetup(session.flows.quickUnlockOf())}
        />
      ) : (
        <>
          <SetupSteps setup={setup} />
          <Button
            testID="quick-close"
            variant="secondary"
            label={setup.step.kind === 'done' ? t.close : t.cancel}
            onPress={() => {
              setup.cancel();
              setSetup(null);
            }}
          />
        </>
      )}
      {!isNil(current) && (
        <>
          <Select
            label={t.lifetime}
            value={String(current.lifetimeMs)}
            options={QUICK_LIFETIME_CHOICES.map(ms => ({
              value: String(ms),
              label: t.hours(ms / HOUR_MS),
            }))}
            onChange={value =>
              session.deviceSettings.update({
                quickUnlock: { ...current, lifetimeMs: Number(value) as typeof current.lifetimeMs },
              })
            }
          />
          {current.kind === 'pattern' && (
            <Checkbox
              label={t.hideLine}
              checked={current.hideLine}
              onChange={hideLine =>
                session.deviceSettings.update({ quickUnlock: { ...current, hideLine } })
              }
            />
          )}
          <Checkbox
            testID="quick-master-after-restart"
            label={t.masterAfterRestart}
            checked={!current.keepOverRestart}
            onChange={ask =>
              session.deviceSettings.update({
                quickUnlock: { ...current, keepOverRestart: !ask },
              })
            }
          />
          <Text style={[styles.note, { color: palette.fgFaint }]}>{t.masterAfterRestartNote}</Text>
          <Button
            testID="quick-switch-off"
            variant="secondary"
            label={t.switchOff}
            onPress={() => session.deviceSettings.update({ quickUnlock: null })}
          />
        </>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  label: { fontSize: TEXT_SIZE.small },
  text: { fontSize: TEXT_SIZE.small },
  note: { fontSize: TEXT_SIZE.caption },
});
