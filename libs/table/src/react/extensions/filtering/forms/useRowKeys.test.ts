import { act, renderHook } from '@testing-library/react';

import { useRowKeys } from './useRowKeys';

function harness(initial: readonly string[]) {
  let items = initial;
  const rendered = renderHook(() => useRowKeys(items));
  return {
    keys: () => rendered.result.current.rows.map(row => row.key),
    add: (item: string) => {
      act(() => rendered.result.current.add());
      items = [...items, item];
      rendered.rerender();
    },
    remove: (index: number) => {
      act(() => rendered.result.current.remove(index));
      items = items.filter((_, at) => at !== index);
      rendered.rerender();
    },
    grow: (next: readonly string[]) => {
      items = next;
      rendered.rerender();
    },
  };
}

describe('row keys for unidentified list rows', () => {
  it('keeps the remaining rows on their keys when one is removed', () => {
    const list = harness(['first', 'second', 'third']);
    const [, second, third] = list.keys();

    list.remove(0);

    expect(list.keys()).toEqual([second, third]);
  });

  it('gives an added row a key no current row has, without touching the others', () => {
    const list = harness(['first']);
    const [first] = list.keys();

    list.add('second');

    const [, second] = list.keys();
    expect(list.keys()[0]).toBe(first);
    expect(second).not.toBe(first);
  });

  it('keys rows the model added by itself and keeps those keys through a later removal', () => {
    const list = harness(['first']);
    list.grow(['first', 'second', 'third']);
    const [, second, third] = list.keys();
    expect(new Set(list.keys()).size).toBe(3);

    list.remove(0);

    expect(list.keys()).toEqual([second, third]);
  });
});
