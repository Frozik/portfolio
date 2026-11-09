import type { IDialingRegion, TCountryCode } from '../../phone/domain/dialing-region';
import { parseNumberMask } from './number-mask';
import { canonicalNumberPattern } from './number-mask-canonical';
import { patternRegexSource } from './pattern-regex';

const RUSSIA: IDialingRegion = {
  country: 'RU' as TCountryCode,
  callingCode: '7',
  nationalPrefix: '8',
};
const NETHERLANDS: IDialingRegion = {
  country: 'NL' as TCountryCode,
  callingCode: '31',
  nationalPrefix: '0',
};
const ITALY: IDialingRegion = {
  country: 'IT' as TCountryCode,
  callingCode: '39',
  nationalPrefix: null,
};

function canonicalRegex(source: string, region: IDialingRegion): RegExp | string {
  const mask = parseNumberMask(source);
  if (!mask.ok) {
    throw new Error(`${source} did not parse`);
  }
  const canonical = canonicalNumberPattern(mask.value, region);
  return canonical.ok
    ? new RegExp(patternRegexSource(canonical.value, 'digits'))
    : canonical.error.kind;
}

describe('a mask in international form', () => {
  it('turns the trunk prefix of a national mask into the calling code', () => {
    const russian = canonicalRegex('8 921*', RUSSIA);
    expect(russian instanceof RegExp && russian.test('79211234567')).toBe(true);
    const dutch = canonicalRegex('06 ........', NETHERLANDS);
    expect(dutch instanceof RegExp && dutch.test('31612345678')).toBe(true);
  });

  it('lets a leading any-digit stand for the trunk prefix', () => {
    const any = canonicalRegex('.{11}', RUSSIA);
    expect(any instanceof RegExp && any.test('79211234567')).toBe(true);
    expect(any instanceof RegExp && any.test('7921123456')).toBe(false);
  });

  it('keeps an international mask as it is', () => {
    const mask = canonicalRegex('+44 7*', RUSSIA);
    expect(mask instanceof RegExp && mask.test('447700900123')).toBe(true);
  });

  it('puts the calling code in front where the country has no trunk prefix', () => {
    const italian = canonicalRegex('06*', ITALY);
    expect(italian instanceof RegExp && italian.test('39061234567')).toBe(true);
  });

  it('takes a lone star as any number, foreign ones included', () => {
    const any = canonicalRegex('*', NETHERLANDS);
    expect(any instanceof RegExp && any.test('442079460000')).toBe(true);
  });

  it('refuses a national mask that cannot start with the trunk prefix', () => {
    expect(canonicalRegex('612*', NETHERLANDS)).toBe('national-prefix-mismatch');
    expect(canonicalRegex('*1234', RUSSIA)).toBe('national-starts-with-wildcard');
  });
});
