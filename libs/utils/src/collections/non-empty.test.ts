import { isNonEmpty } from './non-empty';

describe('isNonEmpty', () => {
  it('narrows a list with an element and refuses an empty one', () => {
    const items: readonly number[] = [1];

    expect(isNonEmpty(items)).toBe(true);
    expect(isNonEmpty([])).toBe(false);
    if (isNonEmpty(items)) {
      expectTypeOf(items[0]).toEqualTypeOf<number>();
    }
  });
});
