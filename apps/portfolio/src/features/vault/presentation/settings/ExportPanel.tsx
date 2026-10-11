import { Checkbox } from '@frozik/components/components/RichEditor/Checkbox';
import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Alert } from '../../../../shared/ui/Alert';
import { Button } from '../../../../shared/ui/Button';
import { RadioGroup } from '../../../../shared/ui/RadioGroup';
import type { TExportFormat, TExportProblem, VaultExport } from '../../application/VaultExport';
import { MASTER_PASSWORD_MIN_LENGTH } from '../../domain/master-password';
import { VaultField } from '../components/VaultField';
import { vaultT } from '../translations';
import { dataT } from '../translations/data';

const FORMATS: readonly TExportFormat[] = ['pwv', 'zip', 'cxf', 'csv'];

function problemText(problem: TExportProblem): string {
  const t = dataT.export.problems;
  return problem === 'too-short' ? t['too-short'](MASTER_PASSWORD_MIN_LENGTH) : t[problem];
}

const Passwords = observer(({ flow }: { readonly flow: VaultExport }) => {
  const t = dataT.export;
  const locale = getCurrentLanguage();
  const prepare = (): void => void flow.prepare();
  if (flow.format !== 'pwv') {
    return (
      <>
        <VaultField label={t.masterPassword} hint={t.masterPasswordHint}>
          {describedBy => (
            <SecretEditor
              aria-label={t.masterPassword}
              aria-describedby={describedBy}
              autoComplete="current-password"
              value={flow.password}
              onValueChange={flow.setPassword}
              onEnter={prepare}
              locale={locale}
            />
          )}
        </VaultField>
        <Checkbox checked={flow.acknowledged} onCheckedChange={flow.setAcknowledged}>
          {t.acknowledgement}
        </Checkbox>
      </>
    );
  }
  return (
    <>
      <VaultField label={t.exportPassword} hint={t.exportPasswordHint(MASTER_PASSWORD_MIN_LENGTH)}>
        {describedBy => (
          <SecretEditor
            aria-label={t.exportPassword}
            aria-describedby={describedBy}
            autoComplete="new-password"
            value={flow.password}
            onValueChange={flow.setPassword}
            locale={locale}
          />
        )}
      </VaultField>
      <VaultField label={t.confirmation}>
        {describedBy => (
          <SecretEditor
            aria-label={t.confirmation}
            aria-describedby={describedBy}
            autoComplete="new-password"
            value={flow.confirmation}
            onValueChange={flow.setConfirmation}
            onEnter={prepare}
            locale={locale}
          />
        )}
      </VaultField>
    </>
  );
});

const Outcome = observer(({ flow }: { readonly flow: VaultExport }) => {
  const t = dataT.export;
  const { step, problem } = flow;
  switch (step.kind) {
    case 'editing':
    case 'preparing':
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!isNil(problem) || step.kind === 'preparing'}
            onClick={() => void flow.prepare()}
          >
            {step.kind === 'preparing' ? t.preparing : t.prepare}
          </Button>
          {step.kind === 'editing' && !isNil(step.failure) && (
            <span className="text-[12px] text-error">{vaultT.unlock.failures[step.failure]}</span>
          )}
          {!isNil(problem) && step.kind === 'editing' && isNil(step.failure) && (
            <span className="text-[12px] text-landing-fg-faint">{problemText(problem)}</span>
          )}
        </div>
      );
    case 'ready':
      return (
        <div className="flex flex-col gap-3">
          {step.missingFiles > 0 && (
            <Alert type="warning" message={t.missingFiles(step.missingFiles)} />
          )}
          <Button type="button" className="self-start" onClick={() => void flow.save()}>
            {t.save(step.file.name)}
          </Button>
        </div>
      );
    case 'saved':
      return (
        <div className="flex flex-col gap-3">
          <Alert type="success" message={t.saved} />
          <Button type="button" variant="secondary" className="self-start" onClick={flow.reset}>
            {t.again}
          </Button>
        </div>
      );
    default:
      return assertNever(step);
  }
});

/**
 * The sealed copy with a password of its own, or the open
 * zip and CSV behind the master password; the file is made, then saved.
 */
export const ExportPanel = observer(({ flow }: { readonly flow: VaultExport }) => {
  const t = dataT.export;
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-[15px] font-medium text-landing-fg">{t.title}</h4>
      <RadioGroup
        options={FORMATS.map(value => ({ value, label: t.formats[value] }))}
        value={flow.format}
        onChange={flow.setFormat}
      />
      <p className="text-[13px] text-landing-fg-dim">{t.descriptions[flow.format]}</p>
      {flow.step.kind === 'editing' && <Passwords flow={flow} />}
      <Outcome flow={flow} />
    </div>
  );
});
