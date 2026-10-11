import { assert } from '@frozik/utils/assert/assert';
import * as fc from 'fast-check';

import words from '../data/eff-large-wordlist/words.json';
import { createSeededRandom } from '../testing/seeded-random';
import { generatePassphrase, PASSPHRASE_DEFAULTS } from './passphrase';
import { generatePin } from './pin';
import { generateRandomPassword, RANDOM_PASSWORD_DEFAULTS } from './random-password';
import { uniformIndex } from './uniform-pick';

const PROPERTY_SEED = 20261011;

describe('password generator', () => {
  it('picks every index equally often, also for sizes that do not divide 2^32', () => {
    const random = createSeededRandom(1);
    const size = 7;
    const draws = 70_000;
    const counts = Array.from({ length: size }, () => 0);
    for (let draw = 0; draw < draws; draw += 1) {
      counts[uniformIndex(random, size)] += 1;
    }
    const expected = draws / size;
    const chiSquare = counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);

    expect(chiSquare).toBeLessThan(22.46);
  });

  it('makes passwords of the asked length with at least the asked digits and symbols', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 8, max: 64 }),
        fc.integer({ min: 0, max: 4 }),
        fc.integer({ min: 0, max: 4 }),
        fc.integer(),
        (length, minDigits, minSymbols, seed) => {
          const result = generateRandomPassword(createSeededRandom(seed), {
            ...RANDOM_PASSWORD_DEFAULTS,
            length,
            minDigits,
            minSymbols,
          });
          assert(result.ok);
          return (
            result.value.value.length === length &&
            (result.value.value.match(/\d/g) ?? []).length >= minDigits &&
            (result.value.value.match(/[^A-Za-z\d]/g) ?? []).length >= minSymbols
          );
        }
      ),
      { seed: PROPERTY_SEED }
    );
  });

  it('leaves out look-alike and excluded characters, and says when nothing is left', () => {
    const random = createSeededRandom(2);
    const result = generateRandomPassword(random, {
      ...RANDOM_PASSWORD_DEFAULTS,
      length: 128,
      excludeSimilar: true,
      exclude: '#$%',
    });

    assert(result.ok);
    expect(result.value.value).not.toMatch(/[Il1O0o|#$%]/);
    expect(
      generateRandomPassword(random, {
        ...RANDOM_PASSWORD_DEFAULTS,
        upper: false,
        lower: false,
        digits: false,
        symbols: false,
      })
    ).toEqual({ ok: false, error: 'no-characters' });
    expect(
      generateRandomPassword(random, {
        ...RANDOM_PASSWORD_DEFAULTS,
        length: 8,
        minDigits: 5,
        minSymbols: 5,
      })
    ).toEqual({ ok: false, error: 'unsatisfiable' });
  });

  it('states the entropy of the method: 20 characters of 87 is about 129 bits', () => {
    const result = generateRandomPassword(createSeededRandom(3), RANDOM_PASSWORD_DEFAULTS);

    assert(result.ok);
    expect(Math.round(result.value.entropyBits)).toBe(
      Math.round(20 * Math.log2(26 + 26 + 10 + 25))
    );
  });

  it('builds passphrases from the EFF list: five words carry about 64.6 bits', () => {
    const result = generatePassphrase(createSeededRandom(4), {
      ...PASSPHRASE_DEFAULTS,
      separator: ' ',
    });

    assert(result.ok);
    const parts = result.value.value.split(' ');
    expect(parts).toHaveLength(5);
    expect(parts.every(word => (words as readonly string[]).includes(word))).toBe(true);
    expect(result.value.entropyBits).toBeCloseTo(5 * Math.log2(7776), 5);
  });

  it('capitalises, adds a digit and separates with digits on request', () => {
    const result = generatePassphrase(createSeededRandom(5), {
      words: 4,
      separator: 'digit',
      capitalize: true,
      includeDigit: true,
    });

    assert(result.ok);
    expect(result.value.value).toMatch(
      /^[A-Z][a-z-]*\d[A-Z][a-z-]*\d[A-Z][a-z-]*\d[A-Z][a-z-]*\d$/
    );
  });

  it('makes PINs of digits only, within 4–12', () => {
    expect(generatePin(createSeededRandom(6), 6).value).toMatch(/^\d{6}$/);
    expect(generatePin(createSeededRandom(6), 2).value).toMatch(/^\d{4}$/);
    expect(generatePin(createSeededRandom(6), 40).value).toMatch(/^\d{12}$/);
  });
});
