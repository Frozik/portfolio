import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TImportWarning } from '@frozik/vault/import/imported-card';
import type { TDataTexts } from './data-texts';

import type { TExportProblem } from '../../interchange/application/VaultExport';
import type { TLockedSource } from '../../interchange/application/VaultImport';
import { MASTER_PASSWORD_MIN_LENGTH } from '../../keys/domain/master-password';

export function exportProblemText(t: TDataTexts, problem: TExportProblem): string {
  const { problems } = t.export;
  return problem === 'too-short'
    ? problems['too-short'](MASTER_PASSWORD_MIN_LENGTH)
    : problems[problem];
}

export function importWarningText(t: TDataTexts, warning: TImportWarning): string {
  const { warnings } = t.import;
  switch (warning.kind) {
    case 'row-skipped':
      return warnings['row-skipped'](warning.row);
    case 'field-dropped':
      return warnings['field-dropped'](warning.card, warning.label);
    case 'passkey-dropped':
      return warnings['passkey-dropped'](warning.card);
    case 'file-dropped':
      return warnings['file-dropped'](warning.card, warning.name);
    case 'item-skipped':
      return warnings['item-skipped'](warning.title);
    default:
      return assertNever(warning);
  }
}

/** What the password field of a locked import source is called and says. */
export function sourcePasswordTexts(
  t: TDataTexts,
  format: TLockedSource['format']
): { readonly label: string; readonly hint: string } {
  const texts = t.import;
  switch (format) {
    case 'pwv':
      return { label: texts.vaultPassword, hint: texts.vaultPasswordHint };
    case 'kdbx':
      return { label: texts.keePassPassword, hint: texts.keePassPasswordHint };
    case 'safeincloud':
      return { label: texts.safeInCloudPassword, hint: texts.safeInCloudPasswordHint };
    default:
      return assertNever(format);
  }
}
