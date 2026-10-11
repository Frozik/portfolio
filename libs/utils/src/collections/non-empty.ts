import type { TNonEmptyArray } from '../types/base';

export function isNonEmpty<T>(items: readonly T[]): items is TNonEmptyArray<T> {
  return items.length > 0;
}
