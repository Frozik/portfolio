import { isPlainObject } from 'lodash-es';

import { compareStrings } from './compare-strings';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return isPlainObject(value);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([first], [second]) => compareStrings(first, second))
        .map(([key, entry]) => [key, sortKeys(entry)])
    );
  }
  return value;
}

/**
 * The same value gives the same string on every device, whatever
 * order its keys were written in: the last tie-break of the merge.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
