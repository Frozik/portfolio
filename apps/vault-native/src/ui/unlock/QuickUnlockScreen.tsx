import type { IKnownVault } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { TQuickEntryProblem, TQuickPrompt } from '@frozik/vault-app/keys/domain/quick-code';
import type { QuickLock } from '@frozik/vault-app/session/application/QuickLock';

import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { TEXT_SIZE } from '../kit/metrics';
import { Screen } from '../kit/Screen';
import { TextField } from '../kit/TextField';
import { useKeysTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { AllVaultsLink } from '../vault/AllVaultsLink';
import { PatternPad } from './PatternPad';
import { PinPad } from './PinPad';

/** A quick lock's one try: the PIN pad, the four characters or the pattern, and always the master password instead. */
export const QuickUnlockScreen = observer(function QuickUnlockScreen({
  vault,
  quick,
  prompt,
  unlocking,
  onUseMaster,
  onLockCompletely,
}: {
  readonly vault: IKnownVault;
  readonly quick: Pick<QuickLock, 'attempt'>;
  readonly prompt: TQuickPrompt;
  readonly unlocking: boolean;
  readonly onUseMaster: () => void;
  /** No key left behind the code: only the master password opens the vault again. */
  readonly onLockCompletely: () => void;
}) {
  const palette = usePalette();
  const t = useKeysTexts();
  const [problem, setProblem] = useState<TQuickEntryProblem | null>(null);
  const [characters, setCharacters] = useState('');
  const attempt = (entry: string | readonly number[]): void => setProblem(quick.attempt(entry));
  const submitCharacters = (): void => {
    if (characters !== '') {
      attempt(characters);
    }
  };
  return (
    <Screen title={vault.name} testID="quick-unlock" back={<AllVaultsLink />}>
      <Text style={[styles.text, { color: palette.fgDim }]}>{t.quickScreen[prompt.kind]}</Text>
      {prompt.kind === 'pin' && (
        <PinPad length={prompt.digits} disabled={unlocking} onComplete={attempt} />
      )}
      {prompt.kind === 'pattern' && (
        <PatternPad hideLine={prompt.hideLine} disabled={unlocking} onComplete={attempt} />
      )}
      {(prompt.kind === 'first-four' || prompt.kind === 'last-four') && (
        <>
          <TextField
            testID="quick-characters"
            label={t.quickScreen[prompt.kind]}
            value={characters}
            onChangeText={setCharacters}
            onSubmitEditing={submitCharacters}
            editable={!unlocking}
            secret
          />
          <Button
            label={t.quickScreen.submit}
            disabled={characters === '' || unlocking}
            onPress={submitCharacters}
          />
        </>
      )}
      {unlocking && <Busy label={t.quickScreen.submit} />}
      {!isNil(problem) && (
        <Text
          accessibilityRole="alert"
          testID="quick-problem"
          style={[styles.text, { color: palette.danger }]}
        >
          {t.quick.problems[problem]}
        </Text>
      )}
      <Text style={[styles.caption, { color: palette.fgFaint }]}>{t.quickScreen.oneTry}</Text>
      <Button
        testID="use-master-password"
        variant="secondary"
        label={t.quickScreen.useMaster}
        onPress={onUseMaster}
      />
      <Button
        testID="lock-completely"
        variant="secondary"
        label={t.quickScreen.lockCompletely}
        onPress={onLockCompletely}
      />
    </Screen>
  );
});

const styles = StyleSheet.create({
  text: { fontSize: TEXT_SIZE.small },
  caption: { fontSize: TEXT_SIZE.caption },
});
