import * as fc from 'fast-check';

import { fromHex } from '../testing/hex';
import { createSeededRandom } from '../testing/seeded-random';
import { toHex } from './bytes';
import { formatRecoveryKey, generateRecoveryKey, parseRecoveryKey } from './recovery-key';

const KEY = fromHex('707172737475767778797a7b7c7d7e7f');
const WRITTEN = 'E1RQ-4WVM-ENV7-EY3S-F9XQ-RZBY-FW85';

describe('recovery key', () => {
  it('is written in Crockford base32 with a CRC-32 checksum, in groups of four (cross-checked in Python)', () => {
    expect(formatRecoveryKey(KEY)).toBe(WRITTEN);
  });

  it('reads back every key it writes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 16, maxLength: 16 }), bytes => {
        const key = new Uint8Array(bytes);
        const parsed = parseRecoveryKey(formatRecoveryKey(key));
        return parsed.ok && toHex(parsed.value) === toHex(key);
      }),
      { seed: 20261010 }
    );
  });

  it('reads a key the way people type it: any case, any spacing, O for 0 and I or L for 1', () => {
    const typed = ' e1rq 4wvm-env7 ey3s f9xq-rzby fw85 ';
    const withLookalikes = 'E1RQ4WVMENV7EY3SF9XQRZBYFW85'.replace('1', 'l').replace('0', 'O');

    expect(parseRecoveryKey(typed)).toEqual({ ok: true, value: KEY });
    expect(parseRecoveryKey(withLookalikes)).toEqual({ ok: true, value: KEY });
    expect(parseRecoveryKey('E1RQ4WVMENV7EY3SF9XQRZBYFW85'.replace('1', 'I'))).toEqual({
      ok: true,
      value: KEY,
    });
  });

  it('calls a mistyped symbol a typo rather than a wrong key', () => {
    expect(parseRecoveryKey('E1RQ-4WVM-ENV7-EY3S-F9XQ-RZBY-FW86')).toEqual({
      ok: false,
      error: 'checksum-mismatch',
    });
    expect(parseRecoveryKey('E1RQ-4WVM-ENV8-EY3S-F9XQ-RZBY-FW85')).toEqual({
      ok: false,
      error: 'checksum-mismatch',
    });
  });

  it.each([
    ['too short', 'E1RQ-4WVM-ENV7-EY3S-F9XQ-RZBY-FW8'],
    ['too long', 'E1RQ-4WVM-ENV7-EY3S-F9XQ-RZBY-FW850'],
    ['a letter base32 leaves out', 'U1RQ-4WVM-ENV7-EY3S-F9XQ-RZBY-FW85'],
    ['bits beyond 128 set', 'E1RQ-4WVM-ENV7-EY3S-F9XQ-RZBY-FX85'],
  ])('refuses a key that is %s as malformed', (_name, text) => {
    expect(parseRecoveryKey(text)).toEqual({ ok: false, error: 'malformed' });
  });

  it('draws 128 fresh bits for every new key', () => {
    const random = createSeededRandom(3);

    expect(generateRecoveryKey(random)).toHaveLength(16);
    expect(toHex(generateRecoveryKey(random))).not.toBe(toHex(generateRecoveryKey(random)));
  });
});
