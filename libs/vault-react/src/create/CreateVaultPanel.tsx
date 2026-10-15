import { Checkbox } from '@frozik/components/components/RichEditor/Checkbox';
import { MultilineEditor } from '@frozik/components/components/RichEditor/MultilineEditor';
import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { Button } from '@frozik/components/ui/Button';
import { CardFrame } from '@frozik/components/ui/CardFrame';
import type { CreateVaultForm } from '@frozik/vault-app/keys/application/CreateVaultForm';
import {
  MASTER_PASSWORD_MIN_LENGTH,
  MASTER_PASSWORD_SUGGESTED_LENGTH,
} from '@frozik/vault-app/keys/domain/master-password';
import { createVaultProblemText } from '@frozik/vault-app/texts/keys/keys-wording';
import { VaultField } from '../form/VaultField';
import { LANGUAGE } from '../texts/language';
import { vaultT } from '../texts/vault';
import { StrengthMeter } from './StrengthMeter';

const DESCRIPTION_MAX_ROWS = 4;

/**
 * Not a `<form>`: nothing here may be posted
 * or offered to autofill as a site login. The hidden username names the
 * vault, so a browser that saves the new password files it under that name.
 */
export const CreateVaultPanel = observer(
  ({
    form,
    note,
    onSubmit,
    onCancel,
  }: {
    readonly form: CreateVaultForm;
    /** Where the new vault goes, when not only this browser. */
    readonly note?: string;
    readonly onSubmit: () => void;
    readonly onCancel: () => void;
  }) => {
    const t = vaultT.create;
    const passwordTouched = form.password !== '';
    const showMismatch = form.confirmation !== '' && form.problem === 'mismatch';

    return (
      <CardFrame className="flex flex-col gap-5 p-6">
        <h2 className="text-[20px] font-medium text-landing-fg">{t.title}</h2>
        {!isNil(note) && <p className="text-[13px] text-landing-fg-dim">{note}</p>}
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
        <VaultField label={t.description} hint={t.descriptionHint}>
          {describedBy => (
            <MultilineEditor
              aria-label={t.description}
              aria-describedby={describedBy}
              maxRows={DESCRIPTION_MAX_ROWS}
              value={form.description}
              onValueChange={form.setDescription}
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
          error={
            passwordTouched && form.problem === 'too-short'
              ? createVaultProblemText(vaultT, 'too-short')
              : null
          }
        >
          {describedBy => (
            <SecretEditor
              aria-label={t.password}
              aria-describedby={describedBy}
              autoComplete="new-password"
              value={form.password}
              onValueChange={form.setPassword}
              locale={LANGUAGE}
            />
          )}
        </VaultField>
        {!isNil(form.strength) && <StrengthMeter strength={form.strength} />}
        <VaultField
          label={t.confirmation}
          error={showMismatch ? createVaultProblemText(vaultT, 'mismatch') : null}
        >
          {describedBy => (
            <SecretEditor
              aria-label={t.confirmation}
              aria-describedby={describedBy}
              aria-invalid={showMismatch}
              autoComplete="new-password"
              value={form.confirmation}
              onValueChange={form.setConfirmation}
              onEnter={onSubmit}
              locale={LANGUAGE}
            />
          )}
        </VaultField>
        <Checkbox checked={form.acknowledged} onCheckedChange={form.setAcknowledged}>
          {t.acknowledgement}
        </Checkbox>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            data-testid="create-submit"
            disabled={!isNil(form.problem)}
            onClick={onSubmit}
          >
            {t.submit}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t.cancel}
          </Button>
          {!isNil(form.problem) && (
            <span className="text-[12px] text-landing-fg-faint">
              {createVaultProblemText(vaultT, form.problem)}
            </span>
          )}
        </div>
      </CardFrame>
    );
  }
);
