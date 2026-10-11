import { isTypeaheadKey, moveActive, typeaheadMatch } from './listbox-navigation';

const OPTIONS = [
  { value: 'de', label: 'Germany' },
  { value: 'gr', label: 'Greece', disabled: true },
  { value: 'gb', label: 'United Kingdom' },
  { value: 'us', label: 'United States' },
  { value: 'ge', label: 'Georgia' },
] as const;

describe('listbox navigation', () => {
  it('steps over disabled options and stops at the ends', () => {
    expect(moveActive(OPTIONS, 0, 'next')).toBe(2);
    expect(moveActive(OPTIONS, 2, 'previous')).toBe(0);
    expect(moveActive(OPTIONS, 4, 'next')).toBe(4);
    expect(moveActive(OPTIONS, undefined, 'next')).toBe(0);
    expect(moveActive(OPTIONS, undefined, 'previous')).toBe(4);
    expect(moveActive(OPTIONS, 3, 'first')).toBe(0);
  });

  it('jumps to the label typed, looking past the active option first', () => {
    expect(typeaheadMatch(OPTIONS, 'u', undefined, 'en')).toBe(2);
    expect(typeaheadMatch(OPTIONS, 'u', 2, 'en')).toBe(3);
    expect(typeaheadMatch(OPTIONS, 'united s', 2, 'en')).toBe(3);
    expect(typeaheadMatch(OPTIONS, 'x', 0, 'en')).toBeUndefined();
  });

  it('cycles through the options one repeated letter starts, never landing on a disabled one', () => {
    expect(typeaheadMatch(OPTIONS, 'g', 0, 'en')).toBe(4);
    expect(typeaheadMatch(OPTIONS, 'gg', 4, 'en')).toBe(0);
  });

  it('takes printable characters only, without modifiers', () => {
    const plain = { ctrlKey: false, metaKey: false, altKey: false };
    expect(isTypeaheadKey({ key: 'ü', ...plain })).toBe(true);
    expect(isTypeaheadKey({ key: 'Enter', ...plain })).toBe(false);
    expect(isTypeaheadKey({ key: 'a', ...plain, metaKey: true })).toBe(false);
  });
});
