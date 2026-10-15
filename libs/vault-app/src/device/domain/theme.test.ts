import { resolveScheme } from './theme';

describe('the colour scheme', () => {
  it.each([
    ['system', true, 'dark'],
    ['system', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
  ] as const)(
    'for the choice %s on a system that is dark: %s is %s',
    (preference, dark, scheme) => {
      expect(resolveScheme(preference, dark)).toBe(scheme);
    }
  );
});
