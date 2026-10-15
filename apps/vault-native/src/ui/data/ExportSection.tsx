import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { StyleSheet, Text } from 'react-native';

import type {
  TExportFormat,
  VaultExport,
} from '@frozik/vault-app/interchange/application/VaultExport';
import { MASTER_PASSWORD_MIN_LENGTH } from '@frozik/vault-app/keys/domain/master-password';
import { exportProblemText } from '@frozik/vault-app/texts/interchange/data-wording';

import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { Checkbox } from '../kit/Checkbox';
import { TEXT_SIZE } from '../kit/metrics';
import { Notice } from '../kit/Notice';
import { Select } from '../kit/Select';
import { TextField } from '../kit/TextField';
import { useDataTexts, useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const FORMATS: readonly TExportFormat[] = ['pwv', 'zip', 'cxf', 'csv'];

/** The vault out of the app: an encrypted copy with its own password, or an open file after the master password. */
export const ExportSection = observer(function ExportSection({
  flow,
}: {
  readonly flow: VaultExport;
}) {
  const palette = usePalette();
  const dataTexts = useDataTexts();
  const vaultTexts = useVaultTexts();
  const t = dataTexts.export;
  const { step, problem } = flow;
  const passwords =
    flow.format === 'pwv' ? (
      <>
        <TextField
          testID="export-password"
          label={t.exportPassword}
          value={flow.password}
          onChangeText={flow.setPassword}
          secret
        />
        <Text style={[styles.hint, { color: palette.fgFaint }]}>
          {t.exportPasswordHint(MASTER_PASSWORD_MIN_LENGTH)}
        </Text>
        <TextField
          testID="export-confirmation"
          label={t.confirmation}
          value={flow.confirmation}
          onChangeText={flow.setConfirmation}
          secret
        />
      </>
    ) : (
      <>
        <TextField
          testID="export-master"
          label={t.masterPassword}
          value={flow.password}
          onChangeText={flow.setPassword}
          secret
        />
        <Text style={[styles.hint, { color: palette.fgFaint }]}>{t.masterPasswordHint}</Text>
        <Checkbox
          testID="export-acknowledged"
          label={t.acknowledgement}
          checked={flow.acknowledged}
          onChange={flow.setAcknowledged}
        />
      </>
    );
  const outcome = (() => {
    switch (step.kind) {
      case 'editing':
      case 'preparing':
        return (
          <>
            {step.kind === 'editing' && !isNil(step.failure) && (
              <Text accessibilityRole="alert" style={[styles.text, { color: palette.danger }]}>
                {vaultTexts.unlock.failures[step.failure]}
              </Text>
            )}
            {!isNil(problem) && step.kind === 'editing' && isNil(step.failure) && (
              <Text style={[styles.hint, { color: palette.fgFaint }]}>
                {exportProblemText(dataTexts, problem)}
              </Text>
            )}
            {step.kind === 'preparing' ? (
              <Busy label={t.preparing} />
            ) : (
              <Button
                testID="export-prepare"
                label={t.prepare}
                disabled={!isNil(problem)}
                onPress={() => void flow.prepare()}
              />
            )}
          </>
        );
      case 'ready':
        return (
          <>
            {step.missingFiles > 0 && (
              <Notice tone="caution" message={t.missingFiles(step.missingFiles)} />
            )}
            <Button
              testID="export-save"
              label={t.save(step.file.name)}
              onPress={() => void flow.save()}
            />
          </>
        );
      case 'saved':
        return (
          <>
            <Notice testID="export-saved" message={t.sharedPhone} />
            <Button variant="secondary" label={t.again} onPress={flow.reset} />
          </>
        );
      default:
        return assertNever(step);
    }
  })();
  return (
    <>
      <Select
        testID="export-format"
        label={t.title}
        value={flow.format}
        options={FORMATS.map(format => ({ value: format, label: t.formats[format] }))}
        onChange={flow.setFormat}
      />
      <Text style={[styles.hint, { color: palette.fgDim }]}>{t.descriptions[flow.format]}</Text>
      {step.kind === 'editing' && passwords}
      {outcome}
    </>
  );
});

const styles = StyleSheet.create({
  text: { fontSize: TEXT_SIZE.small },
  hint: { fontSize: TEXT_SIZE.caption },
});
