import { zipWith } from 'lodash-es';
import { useState } from 'react';

function above(keys: readonly number[]): number {
  return Math.max(-1, ...keys) + 1;
}

/**
 * Keys for list rows the model does not identify, so a row keeps its DOM
 * (and focus) when a neighbour is removed. Rows the model added on its own
 * are keyed above every assigned key until the next add or remove settles them.
 */
export function useRowKeys<TItem>(items: readonly TItem[]): {
  readonly rows: readonly { readonly key: number; readonly item: TItem }[];
  add(): void;
  remove(index: number): void;
} {
  const [assigned, setAssigned] = useState<readonly number[]>([]);
  const next = above(assigned);
  const keys = items.map((_, at) => assigned[at] ?? next + at - assigned.length);
  return {
    rows: zipWith(items, keys, (item, key) => ({ key, item })),
    add: () => setAssigned([...keys, above(keys)]),
    remove: index => setAssigned(keys.filter((_, at) => at !== index)),
  };
}
