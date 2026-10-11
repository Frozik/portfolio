import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Alert } from '../../../../shared/ui/Alert';
import { Button } from '../../../../shared/ui/Button';
import type { TChangePasswordProblem } from '../../application/ChangePasswordForm';
import { ChangePasswordForm } from '../../application/ChangePasswordForm';
import type { SessionKeys } from '../../application/SessionKeys';
import { MASTER_PASSWORD_MIN_LENGTH } from '../../domain/master-password';
import { PanelSection } from '../components/PanelSection';
import { VaultField } from '../components/VaultField';
import { vaultT } from '../translations';
import { keysT } from '../translations/keys';

function problemText(problem: TChangePasswordProblem): string {
  const t = keysT.changePassword.problems;
  switch (problem) {
    case 'too-short':
      return t['too-short'](MASTER_PASSWORD_MIN_LENGTH);
    case 'malformed':
    case 'checksum-mismatch':
      return keysT.recoveryKeyProblems[problem];
    case 'no-current':
    case 'mismatch':
      return t[problem];
    default:
      return assertNever(problem);
  }
}

const Form = observer(
  ({ form, onCancel }: { readonly form: ChangePasswordForm; readonly onCancel: () => void }) => {
    const t = keysT.changePassword;
    const locale = getCurrentLanguage();
    const { step, problem } = form;
    const submit = (): void => void form.submit();
    if (step.kind === 'changed') {
      return <Alert type="success" message={t.changed} />;
    }
    const failure = step.kind === 'editing' ? step.failure : null;
    const currentLabel = form.mode === 'recovery' ? t.currentRecovery : t.current;
    return (
      <div className="flex flex-col gap-4">
        <VaultField
          label={currentLabel}
          error={isNil(failure) ? null : vaultT.unlock.failures[failure]}
        >
          {describedBy => (
            <SecretEditor
              aria-label={currentLabel}
              aria-describedby={describedBy}
              autoComplete={form.mode === 'recovery' ? 'off' : 'current-password'}
              value={form.current}
              onValueChange={form.setCurrent}
              locale={locale}
            />
          )}
        </VaultField>
        <VaultField label={t.password} hint={t.passwordHint(MASTER_PASSWORD_MIN_LENGTH)}>
          {describedBy => (
            <SecretEditor
              aria-label={t.password}
              aria-describedby={describedBy}
              autoComplete="new-password"
              value={form.password}
              onValueChange={form.setPassword}
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
              value={form.confirmation}
              onValueChange={form.setConfirmation}
              onEnter={submit}
              locale={locale}
            />
          )}
        </VaultField>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!isNil(problem) || step.kind === 'changing'}
            onClick={submit}
          >
            {step.kind === 'changing' ? t.changing : t.submit}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t.cancel}
          </Button>
          {!isNil(problem) && step.kind === 'editing' && (
            <span className="text-[12px] text-landing-fg-faint">{problemText(problem)}</span>
          )}
        </div>
      </div>
    );
  }
);

/** A new password slot for the same key, on every device after sync. */
export const ChangePasswordPanel = observer(({ keys }: { readonly keys: SessionKeys }) => {
  const t = keysT.changePassword;
  const [form, setForm] = useState<ChangePasswordForm | null>(() =>
    keys.recovering ? new ChangePasswordForm(keys, 'recovery') : null
  );
  return (
    <PanelSection title={t.title}>
      <p className="text-[13px] text-landing-fg-dim">{t.intro}</p>
      {isNil(form) ? (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => setForm(new ChangePasswordForm(keys, 'password'))}
        >
          {t.open}
        </Button>
      ) : (
        <Form form={form} onCancel={() => setForm(null)} />
      )}
    </PanelSection>
  );
});
