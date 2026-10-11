import { nextActiveIndex } from './list-navigation';

describe('nextActiveIndex', () => {
  it('steps, pages and jumps to the ends without leaving the list', () => {
    expect(nextActiveIndex('ArrowDown', 3, 10, 5)).toBe(4);
    expect(nextActiveIndex('ArrowDown', 9, 10, 5)).toBe(9);
    expect(nextActiveIndex('ArrowUp', 0, 10, 5)).toBe(0);
    expect(nextActiveIndex('PageDown', 7, 10, 5)).toBe(9);
    expect(nextActiveIndex('PageUp', 2, 10, 5)).toBe(0);
    expect(nextActiveIndex('Home', 6, 10, 5)).toBe(0);
    expect(nextActiveIndex('End', 1, 10, 5)).toBe(9);
  });

  it('leaves other keys and an empty list alone', () => {
    expect(nextActiveIndex('a', 3, 10, 5)).toBeNull();
    expect(nextActiveIndex('ArrowDown', 0, 0, 5)).toBeNull();
  });
});
