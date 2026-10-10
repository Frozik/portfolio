import { removeById, replaceById } from './edit-by-id';

interface IItem {
  readonly id: string;
  readonly value: number;
}

const items: readonly IItem[] = [
  { id: 'a', value: 1 },
  { id: 'b', value: 2 },
  { id: 'c', value: 3 },
];

describe('replaceById', () => {
  it('replaces only the item with the id and keeps the others by identity', () => {
    const next = replaceById(items, 'b', item => ({ ...item, value: 20 }));

    expect(next).toEqual([
      { id: 'a', value: 1 },
      { id: 'b', value: 20 },
      { id: 'c', value: 3 },
    ]);
    expect(next[0]).toBe(items[0]);
    expect(next[2]).toBe(items[2]);
  });

  it('returns the same list when no item has the id', () => {
    expect(replaceById(items, 'missing', item => ({ ...item, value: 0 }))).toBe(items);
  });

  it('leaves the original list untouched', () => {
    replaceById(items, 'a', item => ({ ...item, value: 10 }));

    expect(items[0]).toEqual({ id: 'a', value: 1 });
  });
});

describe('removeById', () => {
  it('drops the item with the id', () => {
    expect(removeById(items, 'a')).toEqual([
      { id: 'b', value: 2 },
      { id: 'c', value: 3 },
    ]);
  });

  it('returns the same list when no item has the id', () => {
    expect(removeById(items, 'missing')).toBe(items);
  });
});
