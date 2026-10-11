import { isNil } from 'lodash-es';

import { canonicalJson } from '../model/canonical-json';
import { compareStrings } from '../model/compare-strings';
import type { IHlc } from '../model/hlc';
import { compareHlc } from '../model/hlc';

/**
 * Which of two versions wins: the later stamp, and for equal
 * stamps the canonical JSON, so both devices choose the same one.
 */
export function compareVersions<T>(
  first: T,
  second: T,
  stampOf: (value: T) => IHlc,
  contentOf: (value: T) => unknown
): number {
  const byStamp = compareHlc(stampOf(first), stampOf(second));
  return byStamp !== 0
    ? byStamp
    : compareStrings(canonicalJson(contentOf(first)), canonicalJson(contentOf(second)));
}

export function compareBytes(first: Uint8Array, second: Uint8Array): number {
  const length = Math.min(first.length, second.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (first[index] ?? 0) - (second[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return first.length - second.length;
}

/** Every key of both maps, each value decided by `pick`; `undefined` drops the key. */
export function mergeMaps<Key, Value>(
  local: ReadonlyMap<Key, Value>,
  remote: ReadonlyMap<Key, Value>,
  pick: (key: Key, local: Value | undefined, remote: Value | undefined) => Value | undefined
): ReadonlyMap<Key, Value> {
  const merged = new Map<Key, Value>();
  for (const key of new Set([...local.keys(), ...remote.keys()])) {
    const value = pick(key, local.get(key), remote.get(key));
    if (!isNil(value)) {
      merged.set(key, value);
    }
  }
  return merged;
}
