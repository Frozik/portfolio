import { isNil } from 'lodash-es';

import type { TFieldSpec, TFieldValue } from './card';
import { loginHostOf, registrableDomainOf } from './domains';

interface IFieldLike {
  readonly spec: TFieldSpec;
  readonly value: TFieldValue;
}

function firstValue(fields: readonly IFieldLike[], kind: TFieldSpec['kind']): string | null {
  for (const field of fields) {
    if (field.spec.kind !== kind) {
      continue;
    }
    const value =
      field.value.cardinality === 'single' ? field.value.value : (field.value.values[0] ?? '');
    if (value.trim() !== '') {
      return value.trim();
    }
  }
  return null;
}

/**
 * Two cards are the same account when they share the site
 * (its registrable domain) and the login; a card lacking either has no twin.
 */
export function duplicateKeyOf(fields: readonly IFieldLike[]): string | null {
  const url = firstValue(fields, 'url');
  const host = isNil(url) ? null : loginHostOf(url);
  const login = firstValue(fields, 'login') ?? firstValue(fields, 'email');
  if (isNil(host) || isNil(login)) {
    return null;
  }
  return `${registrableDomainOf(host) ?? host}\n${login.toLowerCase()}`;
}
