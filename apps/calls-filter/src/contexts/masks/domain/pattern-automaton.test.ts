import { array, assert as check, constantFrom, property, stringMatching } from 'fast-check';

import { normalizeName } from '../../phone/domain/name-normalization';
import { parseNameMask } from './name-mask';
import { parseNumberMask } from './number-mask';
import type { TPattern } from './pattern';
import { findIntersection } from './pattern-automaton';
import { patternRegexSource } from './pattern-regex';

const NUMBER_LENGTH = 15;
const NAME_LENGTH = 64;

function digits(source: string): TPattern {
  const mask = parseNumberMask(source);
  if (!mask.ok) {
    throw new Error(`${source} did not parse`);
  }
  return mask.value.pattern;
}

function name(source: string): TPattern {
  const mask = parseNameMask(source);
  if (!mask.ok) {
    throw new Error(`${source} did not parse`);
  }
  return mask.value.pattern;
}

function shared(required: readonly TPattern[], forbidden: readonly TPattern[] = []): string | null {
  return findIntersection({ required, forbidden, alphabet: 'digits', maxLength: NUMBER_LENGTH });
}

describe('the overlap of masks', () => {
  it('finds a number two masks both take', () => {
    const example = shared([digits('+7 495*'), digits('+7 495 1*')]);
    expect(example).not.toBeNull();
    expect(example?.startsWith('74951')).toBe(true);
  });

  it('proves two masks share nothing', () => {
    expect(shared([digits('+7 495*'), digits('+7 499*')])).toBeNull();
    expect(shared([digits('.{5}'), digits('.{6}')])).toBeNull();
  });

  it('no longer overlaps once the winner is excluded from the loser', () => {
    expect(shared([digits('+7 495*'), digits('+7 495 1*')], [digits('+7 495 1*')])).toBeNull();
  });

  it('still overlaps where an exclusion leaves a gap', () => {
    const example = shared([digits('+7 495*'), digits('+7 495 1*')], [digits('+7 495 12*')]);
    expect(example).not.toBeNull();
    expect(example?.startsWith('749512')).toBe(false);
  });

  it('looks no further than the longest number worth reporting', () => {
    const tenDigits = digits('.{10}');
    expect(
      findIntersection({ required: [tenDigits], forbidden: [], alphabet: 'digits', maxLength: 9 })
    ).toBeNull();
    expect(
      findIntersection({ required: [tenDigits], forbidden: [], alphabet: 'digits', maxLength: 10 })
    ).toHaveLength(10);
  });

  it('finds the overlap of name masks', () => {
    const example = findIntersection({
      required: [name('курьер*'), name('*доставка*')],
      forbidden: [],
      alphabet: 'text',
      maxLength: NAME_LENGTH,
    });
    expect(example).not.toBeNull();
    expect(example?.startsWith('курьер')).toBe(true);
    expect(example?.includes('доставка')).toBe(true);
  });

  it('finds an example every mask really accepts', () => {
    const maskSource = array(constantFrom('1', '2', '.', '*', '3{1,2}', '.{2}'), {
      minLength: 1,
      maxLength: 6,
    }).map(parts => parts.join(''));
    check(
      property(maskSource, maskSource, (left, right) => {
        const example = shared([digits(left), digits(right)]);
        if (example !== null) {
          expect(new RegExp(patternRegexSource(digits(left), 'digits')).test(example)).toBe(true);
          expect(new RegExp(patternRegexSource(digits(right), 'digits')).test(example)).toBe(true);
        }
      })
    );
  });

  it('never misses an overlap that a short number reveals', () => {
    const maskSource = array(constantFrom('1', '2', '.', '*', '1{1,2}'), {
      minLength: 1,
      maxLength: 4,
    }).map(parts => parts.join(''));
    const shortNumber = stringMatching(/^[12]{1,5}$/);
    check(
      property(maskSource, maskSource, shortNumber, (left, right, number) => {
        const both =
          new RegExp(patternRegexSource(digits(left), 'digits')).test(number) &&
          new RegExp(patternRegexSource(digits(right), 'digits')).test(number);
        if (both) {
          expect(shared([digits(left), digits(right)])).not.toBeNull();
        }
      })
    );
  });

  it('uses the same normalized text the matcher sees', () => {
    expect(normalizeName('КУРЬЕР Доставка')).toBe('курьер доставка');
  });
});
