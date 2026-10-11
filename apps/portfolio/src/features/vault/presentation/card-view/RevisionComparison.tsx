import { assertNever } from '@frozik/utils/assert/assertNever';
import type { ICardField } from '@frozik/vault/model/card';
import { fieldValues } from '@frozik/vault/model/card';
import type { TCardChange } from '@frozik/vault/model/card-diff';
import { FIELD_KINDS } from '@frozik/vault/model/field-kinds/registry';
import { isNil } from 'lodash-es';

import { changeKey, changeText } from '../editor/change-text';
import { versionsT } from '../translations/versions';

/** A field's value as the comparison shows it: a secret is never written out, only said to be there. */
function shown(field: ICardField | null): string {
  const t = versionsT.compare;
  if (isNil(field)) {
    return '—';
  }
  const values = fieldValues(field);
  if (values.length === 0) {
    return t.empty;
  }
  if (field.sensitive || field.spec.kind === 'unknown') {
    return t.hidden;
  }
  const { spec } = field;
  return values.map(value => FIELD_KINDS[spec.kind].format(value, spec)).join(', ');
}

interface IComparedRow {
  readonly key: string;
  readonly label: string;
  readonly earlier: string;
  readonly current: string;
}

/** `diffCardStates(now, then)`: `before` is the card now, `after` the version then. */
function rowOf(change: TCardChange): IComparedRow {
  switch (change.kind) {
    case 'field-changed':
      return {
        key: changeKey(change),
        label: change.after.label,
        earlier: shown(change.after),
        current: shown(change.before),
      };
    case 'field-added':
      return {
        key: changeKey(change),
        label: change.field.label,
        earlier: shown(change.field),
        current: '—',
      };
    case 'field-removed':
      return {
        key: changeKey(change),
        label: change.field.label,
        earlier: '—',
        current: shown(change.field),
      };
    case 'title':
      return {
        key: changeKey(change),
        label: changeText(change),
        earlier: change.after,
        current: change.before,
      };
    case 'flag':
    case 'appearance':
    case 'groups':
    case 'tabs':
      return { key: changeKey(change), label: changeText(change), earlier: '', current: '' };
    default:
      return assertNever(change);
  }
}

/** A version beside the card now, field by field. */
export function RevisionComparison({ changes }: { readonly changes: readonly TCardChange[] }) {
  const t = versionsT.compare;
  const rows = changes.map(rowOf);
  return (
    <table className="w-full text-left text-[12px]">
      <thead className="text-landing-fg-faint">
        <tr>
          <th className="py-1 pr-3 font-normal" />
          <th className="py-1 pr-3 font-normal">{t.before}</th>
          <th className="py-1 font-normal">{t.after}</th>
        </tr>
      </thead>
      <tbody className="text-landing-fg-dim">
        {rows.map(row => (
          <tr key={row.key} className="border-t border-landing-border-soft align-top">
            <td className="py-1 pr-3 text-landing-fg">{row.label}</td>
            <td className="py-1 pr-3 break-all">{row.earlier}</td>
            <td className="py-1 break-all">{row.current}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
