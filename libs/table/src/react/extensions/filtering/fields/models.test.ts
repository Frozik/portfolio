import { numberText, parseNumber } from './models';

describe('filter number text', () => {
  it('reads numbers the way the locale writes them, grouping and spaces included', () => {
    expect(parseNumber('9,672', 'ru')).toBe(9.672);
    expect(parseNumber('9.672', 'en')).toBe(9.672);
    expect(parseNumber('64 206,71', 'ru')).toBe(64206.71);
    expect(parseNumber('64,206.71', 'en')).toBe(64206.71);
    expect(parseNumber(' ', 'en')).toBeUndefined();
    expect(parseNumber('abc', 'en')).toBeUndefined();
  });

  it('prints a value back in the locale without grouping', () => {
    expect(numberText(9.672, 'ru')).toBe('9,672');
    expect(numberText(64206.71, 'en')).toBe('64206.71');
    expect(numberText(undefined, 'en')).toBe('');
  });
});
