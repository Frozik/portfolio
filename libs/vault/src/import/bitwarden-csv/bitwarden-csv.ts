import { isNil } from 'lodash-es';

import { INTERNET_ACCOUNT_TEMPLATE } from '../../model/templates/internet-account';
import { NOTE_TEMPLATE } from '../../model/templates/note';
import type { IImportBatch, IImportedCard, IImportedField, TImportWarning } from '../imported-card';
import { keyLabel, textLabel } from '../imported-card';
import { extraField, fill, plainCard, templateTabs } from '../template-card';

const REQUIRED = ['type', 'name', 'login_uri', 'login_username', 'login_password'] as const;
const FIRST_DATA_ROW = 2;
const FIELD_SEPARATOR = ': ';
const URL_SEPARATOR = ',';
const MARKED = '1';

type TCellOf = (row: readonly string[], column: string) => string;

/**
 * Bitwarden writes its custom fields one per line as `name: value`, and the
 * line cannot say which were hidden: each comes in as a secret, masked,
 * rather than risk showing a recovery code in the open.
 */
function customFields(text: string): readonly IImportedField[] {
  return text
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => {
      const separator = line.indexOf(FIELD_SEPARATOR);
      return separator < 0
        ? extraField('secret', textLabel(''), line)
        : extraField(
            'secret',
            textLabel(line.slice(0, separator)),
            line.slice(separator + FIELD_SEPARATOR.length)
          );
    });
}

function cardOf(row: readonly string[], cell: TCellOf): IImportedCard | null {
  const type = cell(row, 'type');
  const notes = fill(cell(row, 'notes'));
  const extras = customFields(cell(row, 'fields'));
  const details = {
    groups: [cell(row, 'folder'), ...cell(row, 'collections').split(URL_SEPARATOR)]
      .map(name => name.trim())
      .filter(name => name !== ''),
    favorite: cell(row, 'favorite') === MARKED,
    protected: cell(row, 'reprompt') === MARKED,
  };
  if (type === 'note') {
    return plainCard(
      NOTE_TEMPLATE,
      cell(row, 'name'),
      templateTabs(NOTE_TEMPLATE, { 'field.notes': notes }, extras),
      details
    );
  }
  if (type !== 'login') {
    return null;
  }
  const otp = cell(row, 'login_totp');
  return plainCard(
    INTERNET_ACCOUNT_TEMPLATE,
    cell(row, 'name'),
    templateTabs(
      INTERNET_ACCOUNT_TEMPLATE,
      {
        'field.websites': fill(
          cell(row, 'login_uri')
            .split(URL_SEPARATOR)
            .map(url => url.trim())
        ),
        'field.login': fill(cell(row, 'login_username')),
        'field.password': fill(cell(row, 'login_password')),
        'field.notes': notes,
      },
      [...(otp === '' ? [] : [extraField('otp', keyLabel('field.oneTimeCode'), otp)]), ...extras]
    ),
    details
  );
}

/**
 * Bitwarden's CSV, which is also what this vault exports as
 * CSV: logins and notes, a folder per row. `null` when the header is not its.
 */
export function importBitwardenCsv(rows: readonly (readonly string[])[]): IImportBatch | null {
  const [header, ...data] = rows;
  const names = header?.map(name => name.trim().toLowerCase()) ?? [];
  if (isNil(header) || !REQUIRED.every(column => names.includes(column))) {
    return null;
  }
  const cell: TCellOf = (row, column) => {
    const position = names.indexOf(column);
    return position < 0 ? '' : (row[position] ?? '');
  };
  const cards: IImportedCard[] = [];
  const warnings: TImportWarning[] = [];
  data.forEach((row, index) => {
    const card = row.length === header.length ? cardOf(row, cell) : null;
    if (isNil(card)) {
      warnings.push({ kind: 'row-skipped', row: index + FIRST_DATA_ROW });
    } else {
      cards.push(card);
    }
  });
  return { source: 'bitwarden', cards, links: [], assets: [], warnings };
}
