import { manifestVersionOf } from './manifest-version.ts';

describe('manifestVersionOf', () => {
  it('takes the release CI hands over as a tag', () => {
    expect(manifestVersionOf('v2.50.0')).toBe('2.50.0');
  });

  it('takes a bare version as it is', () => {
    expect(manifestVersionOf('2.50.0')).toBe('2.50.0');
  });

  it('drops what Chrome refuses after the three numbers', () => {
    expect(manifestVersionOf('v2.50.0-3-g48ce7b1-dirty')).toBe('2.50.0');
  });

  it('gives nothing when there is no release version', () => {
    expect([undefined, '', 'unknown', '48ce7b1'].map(manifestVersionOf)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});
