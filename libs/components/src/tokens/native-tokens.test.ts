import { NATIVE_PALETTES } from './native-tokens';

const NATIVE_COLOR = /^(#[0-9a-f]{6}|rgba\(\d+, \d+, \d+, [\d.]+\))$/i;

describe('the native palettes', () => {
  it.each(['light', 'dark'] as const)(
    'give every role of the %s scheme in a form React Native reads',
    scheme => {
      expect(
        Object.values(NATIVE_PALETTES[scheme]).filter(color => !NATIVE_COLOR.test(color))
      ).toEqual([]);
    }
  );

  it('name the roles in camel case and keep their colours', () => {
    expect([NATIVE_PALETTES.dark.bgElevated, NATIVE_PALETTES.light.lineSoft]).toEqual([
      '#0d1016',
      'rgba(0, 0, 0, 0.06)',
    ]);
  });
});
