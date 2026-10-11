import { formatCsv } from '@frozik/utils/csv/csv';
import { isNil, partition } from 'lodash-es';

import type { ICardField, IVaultCard, TFieldSpec } from '../../model/card';
import { allFields, valuesInUse } from '../../model/card';
import { liveGroupIds } from '../../model/group-edits';
import type { IVaultDocument } from '../../model/vault-document';

/** Bitwarden's CSV columns: what most password managers read. */
const HEADER = [
  'folder',
  'favorite',
  'type',
  'name',
  'notes',
  'fields',
  'reprompt',
  'login_uri',
  'login_username',
  'login_password',
  'login_totp',
] as const;

const LOGIN_KINDS: ReadonlySet<TFieldSpec['kind']> = new Set(['url', 'login', 'password']);
/** Columns of their own; a field of these kinds beyond the first goes to `fields` like any other. */
const LOGIN_COLUMN_KINDS = ['note', 'login', 'password', 'otp'] as const;
const NOTE_COLUMN_KINDS = ['note'] as const;
const MARKED = '1';
const UNMARKED = '0';

function rowOf(document: IVaultDocument, card: IVaultCard): readonly string[] {
  const fields = allFields(card).filter(
    field => field.spec.kind !== 'file' && valuesInUse(field).length > 0
  );
  const isLogin = fields.some(field => LOGIN_KINDS.has(field.spec.kind));
  const columns = new Map<string, ICardField>();
  for (const kind of isLogin ? LOGIN_COLUMN_KINDS : NOTE_COLUMN_KINDS) {
    const field =
      fields.find(candidate => candidate.spec.kind === kind) ??
      (kind === 'login' ? fields.find(candidate => candidate.spec.kind === 'email') : undefined);
    if (!isNil(field)) {
      columns.set(kind, field);
    }
  }
  const column = (kind: (typeof LOGIN_COLUMN_KINDS)[number]): string => {
    const field = columns.get(kind);
    return isNil(field) ? '' : valuesInUse(field).join('\n');
  };
  const urls = isLogin ? fields.filter(field => field.spec.kind === 'url') : [];
  const rest = fields.filter(
    field => !urls.includes(field) && ![...columns.values()].includes(field)
  );
  const [multiline, oneLine] = partition(rest, field =>
    valuesInUse(field).some(value => value.includes('\n'))
  );
  const [folder] = liveGroupIds(document, card.groupIds).flatMap(id => {
    const name = document.groups.get(id)?.name;
    return isNil(name) ? [] : [name];
  });
  return [
    folder ?? '',
    card.favorite ? MARKED : '',
    isLogin ? 'login' : 'note',
    card.title,
    [column('note'), ...multiline.map(field => `${field.label}:\n${valuesInUse(field).join('\n')}`)]
      .filter(block => block !== '')
      .join('\n\n'),
    oneLine.map(field => `${field.label}: ${valuesInUse(field).join(', ')}`).join('\n'),
    card.protected ? MARKED : UNMARKED,
    urls.flatMap(valuesInUse).join(','),
    column('login'),
    column('password'),
    column('otp'),
  ];
}

/**
 * Every card outside the trash as a row of Bitwarden's CSV:
 * accounts as logins (the email standing in for a missing login), everything
 * else as notes with its fields in `fields`, one `label: value` per line — so
 * a value of several lines goes to the notes instead. Files do not fit a
 * CSV; the open zip has them.
 */
export function exportCsv(document: IVaultDocument): string {
  const cards = [...document.cards.values()].filter(card => isNil(card.trashedAt));
  return formatCsv([HEADER, ...cards.map(card => rowOf(document, card))]);
}
