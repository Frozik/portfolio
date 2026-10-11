import { Checkbox } from '@frozik/components/components/RichEditor/Checkbox';
import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Button } from '../../../../shared/ui/Button';
import { CardFrame } from '../../../../shared/ui/CardFrame';
import type { CreateVaultForm } from '../../application/CreateVaultForm';
import {
  MASTER_PASSWORD_MIN_LENGTH,
  MASTER_PASSWORD_SUGGESTED_LENGTH,
} from '../../domain/master-password';
import { VaultField } from '../components/VaultField';
import { vaultT } from '../translations';
import { StrengthMeter } from './StrengthMeter';

function problemText(problem: NonNullable<CreateVaultForm['problem']>): string {
  const problems = vaultT.create.problems;
  switch (problem) {
    case 'no-name':
      return problems['no-name'];
    case 'too-short':
      return problems['too-short'](MASTER_PASSWORD_MIN_LENGTH);
    case 'mismatch':
      return problems.mismatch;
    case 'not-acknowledged':
      return problems['not-acknowledged'];
    default:
      return assertNever(problem);
  }
}

/**
 * Not a `<form>`: nothing here may be posted
 * or offered to autofill as a site login. The hidden username names the
 * vault, so a browser that saves the new password files it under that name.
 */
export const CreateVaultPanel = observer(
  ({
    form,
    onSubmit,
    onCancel,
  }: {
    readonly form: CreateVaultForm;
    readonly onSubmit: () => void;
    readonly onCancel: () => void;
  }) => {
    const t = vaultT.create;
    const locale = getCurrentLanguage();
    const passwordTouched = form.password !== '';
    const showMismatch = form.confirmation !== '' && form.problem === 'mismatch';

    return (
      <CardFrame className="flex flex-col gap-5 p-6">
        <h2 className="text-[20px] font-medium text-landing-fg">{t.title}</h2>
        <VaultField label={t.name}>
          {describedBy => (
            <TextEditor
              aria-label={t.name}
              aria-describedby={describedBy}
              value={form.name}
              onValueChange={form.setName}
            />
          )}
        </VaultField>
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={form.name}
          readOnly
          hidden
        />
        <VaultField
          label={t.password}
          hint={t.passwordHint(MASTER_PASSWORD_MIN_LENGTH, MASTER_PASSWORD_SUGGESTED_LENGTH)}
          error={passwordTouched && form.problem === 'too-short' ? problemText('too-short') : null}
        >
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
        {!isNil(form.strength) && <StrengthMeter strength={form.strength} />}
        <VaultField label={t.confirmation} error={showMismatch ? problemText('mismatch') : null}>
          {describedBy => (
            <SecretEditor
              aria-label={t.confirmation}
              aria-describedby={describedBy}
              aria-invalid={showMismatch}
              autoComplete="new-password"
              value={form.confirmation}
              onValueChange={form.setConfirmation}
              onEnter={onSubmit}
              locale={locale}
            />
          )}
        </VaultField>
        <Checkbox checked={form.acknowledged} onCheckedChange={form.setAcknowledged}>
          {t.acknowledgement}
        </Checkbox>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={!isNil(form.problem)} onClick={onSubmit}>
            {t.submit}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t.cancel}
          </Button>
          {!isNil(form.problem) && (
            <span className="text-[12px] text-landing-fg-faint">{problemText(form.problem)}</span>
          )}
        </div>
      </CardFrame>
    );
  }
);
