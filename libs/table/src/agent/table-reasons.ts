import { tableTranslationsEn } from '../react/translations/en';

/**
 * Plain-English text for the reason keys commands refuse with, so an agent reads
 * why instead of an i18n key. The UI's own reasons come first; the editing and
 * column reasons the UI shows as disabled states are spelled out here.
 */
const REASONS: Readonly<Record<string, string>> = {
  ...tableTranslationsEn.reasons,
  'editing.readOnly': 'The table is read-only',
  'editing.notEditable': 'This cell is not editable',
  'editing.notLoaded': 'The row has not loaded yet',
  'editing.updating': 'The row is being saved; try again in a moment',
  'editing.invalid': 'The value is invalid',
  'filtering.readOnly': 'This filter is read-only',
  'lock.hide': 'This column cannot be hidden',
  'columns.lastVisible': 'The last visible column cannot be hidden',
};

export function reasonText(reason: string, extra: Readonly<Record<string, string>> = {}): string {
  return extra[reason] ?? REASONS[reason] ?? reason;
}
