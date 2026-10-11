import { moveItem, removeItem, replaceItem } from './list-edit';

describe('list edits', () => {
  it('moves an item to another place and keeps the rest in order', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('leaves the list alone for a position outside it', () => {
    const items = ['a', 'b'];
    expect(moveItem(items, 1, 2)).toBe(items);
    expect(removeItem(items, -1)).toBe(items);
    expect(replaceItem(items, 2, 'z')).toBe(items);
  });

  it('removes and replaces one item without touching the original', () => {
    const items = ['a', 'b', 'c'];
    expect(removeItem(items, 1)).toEqual(['a', 'c']);
    expect(replaceItem(items, 1, 'z')).toEqual(['a', 'z', 'c']);
    expect(items).toEqual(['a', 'b', 'c']);
  });
});
