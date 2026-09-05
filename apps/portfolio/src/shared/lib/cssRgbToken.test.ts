import { parseHexRgb, readCssRgbToken } from './cssRgbToken';

describe('parseHexRgb', () => {
  it('parses a six-digit hex colour regardless of case and surrounding whitespace', () => {
    expect(parseHexRgb('  #60A5fa ')).toEqual([96, 165, 250]);
  });

  it('rejects anything that is not a six-digit hex colour', () => {
    expect(parseHexRgb('#fff')).toBeUndefined();
    expect(parseHexRgb('rgb(1 2 3)')).toBeUndefined();
    expect(parseHexRgb('')).toBeUndefined();
  });
});

describe('readCssRgbToken', () => {
  it('falls back when the token is not a hex colour, and resolves each token once', () => {
    const spy = vi.spyOn(window, 'getComputedStyle');
    const fallback = [1, 2, 3] as const;

    expect(readCssRgbToken('--color-test-missing', fallback)).toBe(fallback);
    expect(readCssRgbToken('--color-test-missing', fallback)).toBe(fallback);

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
