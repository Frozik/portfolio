import { androidVersionCode } from './android-version-code.ts';

describe('the Android versionCode of a release', () => {
  it('grows with every later release', () => {
    expect(['v1.4.0', 'v1.4.1', 'v1.5.0', 'v2.0.0'].map(androidVersionCode)).toEqual([
      1_004_000, 1_004_001, 1_005_000, 2_000_000,
    ]);
  });

  it('refuses a minor or patch that would spill into the next field', () => {
    expect(() => androidVersionCode('v1.1000.0')).toThrow('minor and patch');
  });

  it('refuses what is not a release, and a release that gives no code', () => {
    expect(() => androidVersionCode('main')).toThrow('Not a release');
    expect(() => androidVersionCode('v0.0.0')).toThrow('outside');
  });
});
