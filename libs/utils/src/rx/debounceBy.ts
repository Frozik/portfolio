import { debounce, isNil } from 'lodash-es';

import { assert } from '../assert/assert';

// biome-ignore lint/suspicious/noExplicitAny: generic wrapper requires any for arbitrary signatures
export function debounceBy<A extends any[], F extends (...args: A) => any>(
  fn: F,
  groupBy: (args: A) => { group: boolean | number | string; delay: number }
): (...args: A) => void {
  const mapDebounced = new Map<string | number | boolean, (...args: A) => unknown>();

  return function debouncedBy(...args: A) {
    const { group, delay } = groupBy(args);

    if (!mapDebounced.has(group)) {
      mapDebounced.set(
        group,
        debounce((...args: A) => {
          fn(...args);
          mapDebounced.delete(group);
        }, delay)
      );
    }
    const debounced = mapDebounced.get(group);
    assert(!isNil(debounced), 'Debounced function must exist after being set');

    debounced(...args);
  };
}
