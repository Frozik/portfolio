import { isNil } from 'lodash-es';

import { loginHostOf } from '../../model/domains';
import { INTERNET_ACCOUNT_TEMPLATE } from '../../model/templates/internet-account';
import type { IImportBatch, IImportedCard, TImportWarning } from '../imported-card';
import { keyLabel } from '../imported-card';
import { extraField, fill, plainCard, templateTabs } from '../template-card';

type TColumn = 'title' | 'url' | 'username' | 'password' | 'notes' | 'otp' | 'createdAt';

/** How each browser names its columns, lower-cased; the first profile whose required columns are all there wins. */
interface IBrowserProfile {
  readonly source: 'chrome' | 'firefox' | 'safari';
  readonly columns: Readonly<Partial<Record<TColumn, string>>>;
  readonly required: readonly TColumn[];
}

const PROFILES: readonly IBrowserProfile[] = [
  {
    source: 'firefox',
    columns: {
      url: 'url',
      username: 'username',
      password: 'password',
      createdAt: 'timecreated',
    },
    required: ['url', 'username', 'password', 'createdAt'],
  },
  {
    source: 'safari',
    columns: {
      title: 'title',
      url: 'url',
      username: 'username',
      password: 'password',
      notes: 'notes',
      otp: 'otpauth',
    },
    required: ['title', 'url', 'username', 'password'],
  },
  {
    source: 'chrome',
    columns: {
      title: 'name',
      url: 'url',
      username: 'username',
      password: 'password',
      notes: 'note',
    },
    required: ['title', 'url', 'username', 'password'],
  },
];

/** The header is row 1. */
const FIRST_DATA_ROW = 2;

type TCellOf = (row: readonly string[], column: TColumn) => string;

function cellReader(profile: IBrowserProfile, header: readonly string[]): TCellOf {
  const positions = header.map(name => name.trim().toLowerCase());
  return (row, column) => {
    const name = profile.columns[column];
    const position = isNil(name) ? -1 : positions.indexOf(name);
    return position < 0 ? '' : (row[position] ?? '').trim();
  };
}

function profileOf(header: readonly string[]): IBrowserProfile | null {
  const names = new Set(header.map(name => name.trim().toLowerCase()));
  return (
    PROFILES.find(profile =>
      profile.required.every(column => names.has(profile.columns[column] ?? ''))
    ) ?? null
  );
}

function cardOf(row: readonly string[], cell: TCellOf): IImportedCard {
  const url = cell(row, 'url');
  const username = cell(row, 'username');
  const otp = cell(row, 'otp');
  const createdAtMs = Number.parseInt(cell(row, 'createdAt'), 10);
  return plainCard(
    INTERNET_ACCOUNT_TEMPLATE,
    cell(row, 'title') || loginHostOf(url) || url || username,
    templateTabs(
      INTERNET_ACCOUNT_TEMPLATE,
      {
        'field.websites': fill([url]),
        'field.login': fill(username),
        'field.password': fill(cell(row, 'password')),
        'field.notes': fill(cell(row, 'notes')),
      },
      otp === '' ? [] : [extraField('otp', keyLabel('field.oneTimeCode'), otp)]
    ),
    { createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : null }
  );
}

/**
 * The password CSV of Chrome and Edge, Firefox and Safari:
 * one internet account per row. `null` when the header is none of theirs.
 */
export function importBrowserCsv(rows: readonly (readonly string[])[]): IImportBatch | null {
  const [header, ...data] = rows;
  const profile = isNil(header) ? null : profileOf(header);
  if (isNil(header) || isNil(profile)) {
    return null;
  }
  const cell = cellReader(profile, header);
  const cards: IImportedCard[] = [];
  const warnings: TImportWarning[] = [];
  data.forEach((row, index) => {
    if (row.length !== header.length || [cell(row, 'url'), cell(row, 'password')].every(isBlank)) {
      warnings.push({ kind: 'row-skipped', row: index + FIRST_DATA_ROW });
      return;
    }
    cards.push(cardOf(row, cell));
  });
  return { source: profile.source, cards, links: [], assets: [], warnings };
}

function isBlank(value: string): boolean {
  return value === '';
}
