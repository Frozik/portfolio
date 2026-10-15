import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { RecoveryKeyFlow } from '@frozik/vault-app/keys/application/RecoveryKeyFlow';

import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { TEXT_SIZE } from '../kit/metrics';
import { TextField } from '../kit/TextField';
import { useKeysTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';
import { textEmergencyKit } from './text-emergency-kit';

const FlowSteps = observer(function FlowSteps({ flow }: { readonly flow: RecoveryKeyFlow }) {
  const palette = usePalette();
  const vaultTexts = useVaultTexts();
  const t = useKeysTexts().recoveryKey;
  const { step } = flow;
  switch (step.kind) {
    case 'idle':
      return null;
    case 'shown':
      return (
        <>
          <Text style={[styles.text, { color: palette.fgDim }]}>{t.shown}</Text>
          <Text
            testID="recovery-key-shown"
            selectable={false}
            style={[styles.key, { color: palette.fg }]}
          >
            {step.formatted}
          </Text>
          {flow.kit.kind === 'making' && <Busy label={t.kitMaking} />}
          {flow.kit.kind === 'failed' && (
            <Text style={[styles.text, { color: palette.danger }]}>{t.kitFailed}</Text>
          )}
          <Button
            variant="secondary"
            label={t.saveKitText}
            disabled={flow.kit.kind !== 'ready'}
            onPress={flow.saveKit}
          />
          <Button testID="recovery-written" label={t.written} onPress={flow.toConfirmation} />
        </>
      );
    case 'confirming':
      return (
        <>
          <TextField
            testID="recovery-last-group"
            label={t.lastGroup}
            value={flow.lastGroup}
            onChangeText={flow.setLastGroup}
          />
          <Text style={[styles.hint, { color: palette.fgFaint }]}>{t.lastGroupHint}</Text>
          <TextField
            testID="recovery-password"
            label={t.password}
            value={flow.password}
            onChangeText={flow.setPassword}
            secret
          />
          {!isNil(step.failure) && (
            <Text accessibilityRole="alert" style={[styles.text, { color: palette.danger }]}>
              {vaultTexts.unlock.failures[step.failure]}
            </Text>
          )}
          <Button
            testID="recovery-confirm"
            label={t.confirm}
            disabled={!flow.canConfirm}
            onPress={() => void flow.confirm()}
          />
        </>
      );
    case 'saving':
      return <Busy label={t.saving} />;
    case 'done':
      return (
        <Text testID="recovery-done" style={[styles.text, { color: palette.positive }]}>
          {t.done}
        </Text>
      );
    default:
      return assertNever(step);
  }
});

/** The Emergency Kit's key: made, shown once, confirmed by its last group and the master password. */
export const RecoveryKeySection = observer(function RecoveryKeySection() {
  const session = useSession();
  const palette = usePalette();
  const keysTexts = useKeysTexts();
  const vaultTexts = useVaultTexts();
  const t = keysTexts.recoveryKey;
  const [flow, setFlow] = useState<RecoveryKeyFlow | null>(null);
  useEffect(() => () => flow?.dispose(), [flow]);
  const open = (): void => {
    const next = session.flows.recoveryKeyOf(
      textEmergencyKit(keysTexts, session.document.settings.name)
    );
    next.start();
    setFlow(next);
  };
  return (
    <>
      <Text style={[styles.label, { color: palette.fgDim }]}>{t.title}</Text>
      <Text style={[styles.text, { color: palette.fgDim }]}>
        {session.keys.hasRecoveryKey ? t.present : t.none}
      </Text>
      {isNil(flow) || flow.step.kind === 'idle' ? (
        <Button
          testID="recovery-create"
          variant="secondary"
          label={session.keys.hasRecoveryKey ? t.replace : t.create}
          onPress={open}
        />
      ) : (
        <>
          <FlowSteps flow={flow} />
          {flow.step.kind === 'done' && (
            <Button
              testID="recovery-close"
              variant="secondary"
              label={vaultTexts.phone.close}
              onPress={() => setFlow(null)}
            />
          )}
          {flow.step.kind !== 'done' && flow.step.kind !== 'saving' && (
            <Button variant="secondary" label={t.cancel} onPress={() => flow.cancel()} />
          )}
        </>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  label: { fontSize: TEXT_SIZE.small },
  text: { fontSize: TEXT_SIZE.small },
  hint: { fontSize: TEXT_SIZE.caption },
  key: { fontSize: TEXT_SIZE.heading, fontFamily: 'monospace', letterSpacing: 1 },
});
