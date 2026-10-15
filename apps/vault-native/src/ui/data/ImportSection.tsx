import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TDuplicatePolicy } from '@frozik/vault/import/apply-import';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { StyleSheet, Text } from 'react-native';

import type { VaultImport } from '@frozik/vault-app/interchange/application/VaultImport';
import {
  importWarningText,
  sourcePasswordTexts,
} from '@frozik/vault-app/texts/interchange/data-wording';

import { pickOneFile } from '../../device-files/pick-files';
import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { TEXT_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { Select } from '../kit/Select';
import { TextField } from '../kit/TextField';
import { useDataTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const DUPLICATE_POLICIES: readonly TDuplicatePolicy[] = ['skip', 'replace', 'keep-both'];

/** An export from another manager or another vault, read, previewed and only then added. */
export const ImportSection = observer(function ImportSection({
  flow,
}: {
  readonly flow: VaultImport;
}) {
  const palette = usePalette();
  const dataTexts = useDataTexts();
  const vaultTexts = useVaultTexts();
  const t = dataTexts.import;
  const { step } = flow;
  const choose = (): void => {
    void pickOneFile().then(file => {
      if (!isNil(file)) {
        void flow.choose(file.bytes);
      }
    });
  };
  const body = (() => {
    switch (step.kind) {
      case 'choosing':
        return (
          <Button
            testID="import-choose"
            variant="secondary"
            label={t.choosePhone}
            onPress={choose}
          />
        );
      case 'failed':
        return (
          <>
            <Notice testID="import-failed" tone="error" message={t.failures[step.error]} />
            <Button variant="secondary" label={t.another} onPress={flow.reset} />
          </>
        );
      case 'vault-password': {
        const texts = sourcePasswordTexts(dataTexts, step.source.format);
        return (
          <>
            <TextField
              testID="import-password"
              label={texts.label}
              value={flow.vaultPassword}
              onChangeText={flow.setVaultPassword}
              secret
            />
            <Text style={[styles.hint, { color: palette.fgFaint }]}>{texts.hint}</Text>
            {!isNil(step.failure) && (
              <Text accessibilityRole="alert" style={[styles.text, { color: palette.danger }]}>
                {vaultTexts.unlock.failures[step.failure]}
              </Text>
            )}
            {step.opening ? (
              <Busy label={t.opening} />
            ) : (
              <Button
                testID="import-open"
                label={t.open}
                disabled={!flow.canOpen}
                onPress={() => void flow.openVaultFile()}
              />
            )}
            <Button variant="secondary" label={t.cancel} onPress={flow.reset} />
          </>
        );
      }
      case 'preview':
        return (
          <>
            <Text testID="import-found" style={[styles.text, { color: palette.fg }]}>
              {t.found(t.sources[step.batch.source], step.preview.cards)}
            </Text>
            {step.batch.warnings.map(warning => (
              <Text key={JSON.stringify(warning)} style={[styles.hint, { color: palette.caution }]}>
                {importWarningText(dataTexts, warning)}
              </Text>
            ))}
            {step.preview.duplicates > 0 && (
              <Select
                label={t.duplicates(step.preview.duplicates)}
                value={flow.duplicates}
                options={DUPLICATE_POLICIES.map(policy => ({
                  value: policy,
                  label: t.duplicateChoices[policy],
                }))}
                onChange={flow.setDuplicates}
              />
            )}
            {step.importing ? (
              <Busy label={t.importing} />
            ) : (
              <Button
                testID="import-confirm"
                label={t.confirm}
                onPress={() => void flow.confirm()}
              />
            )}
            <Button variant="secondary" label={t.cancel} onPress={flow.reset} />
          </>
        );
      case 'done':
        return (
          <>
            <Notice
              testID="import-done"
              message={t.done(step.outcome.added, step.outcome.replaced, step.outcome.skipped)}
            />
            {step.outcome.filesDropped > 0 && (
              <Notice tone="caution" message={t.filesDropped(step.outcome.filesDropped)} />
            )}
            <Button variant="secondary" label={t.another} onPress={flow.reset} />
          </>
        );
      default:
        return assertNever(step);
    }
  })();
  return (
    <>
      <Text style={[styles.label, { color: palette.fgDim }]}>{t.title}</Text>
      <Text style={[styles.hint, { color: palette.fgFaint }]}>{t.intro}</Text>
      {body}
    </>
  );
});

const styles = StyleSheet.create({
  label: { fontSize: TEXT_SIZE.small },
  text: { fontSize: TEXT_SIZE.small },
  hint: { fontSize: TEXT_SIZE.caption },
});
