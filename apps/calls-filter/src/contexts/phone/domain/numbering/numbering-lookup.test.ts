import type { TE164Digits } from '../caller';
import type { INumberingMask } from './gen/numbering-codes';
import { numberingOf } from './numbering-lookup';

const KIROV: INumberingMask = {
  mask: '+7963000*',
  countryCode: 'RU',
  networkOperatorCode: 'beeline',
  stateCodes: ['kirov-oblast'],
};
const KURGAN: INumberingMask = {
  mask: '+796300*',
  countryCode: 'RU',
  networkOperatorCode: 'beeline',
  stateCodes: ['kurgan-oblast'],
  children: [KIROV],
};
const PERM: INumberingMask = {
  mask: '+796301*',
  countryCode: 'RU',
  networkOperatorCode: 'beeline',
  stateCodes: ['perm-krai'],
};
const BEELINE: INumberingMask = {
  mask: '+7963*',
  countryCode: 'RU',
  networkOperatorCode: 'beeline',
  stateCodes: ['moscow', 'moscow-oblast'],
  children: [KURGAN, PERM],
};
const KAZAKHSTAN: INumberingMask = { mask: '+77*', countryCode: 'KZ' };
const RUSSIA: INumberingMask = { mask: '+7*', countryCode: 'RU', children: [BEELINE, KAZAKHSTAN] };
const NETHERLANDS: INumberingMask = { mask: '+31*', countryCode: 'NL' };

const ROOTS: readonly INumberingMask[] = [NETHERLANDS, RUSSIA];

function lookup(digits: string): INumberingMask | null {
  return numberingOf(ROOTS, digits as TE164Digits);
}

describe('telling a number by the numbering catalogue', () => {
  it('descends to the deepest mask that covers the number', () => {
    expect(lookup('79630001234')).toBe(KIROV);
  });

  it('stops at the parent when none of its children covers the number', () => {
    expect(lookup('79630051234')).toBe(KURGAN);
    expect(lookup('79639991234')).toBe(BEELINE);
    expect(lookup('74951234567')).toBe(RUSSIA);
  });

  it('takes the sibling that covers the number', () => {
    expect(lookup('79630101234')).toBe(PERM);
    expect(lookup('77011234567')).toBe(KAZAKHSTAN);
    expect(lookup('31612345678')).toBe(NETHERLANDS);
  });

  it('answers nothing for a number no country code covers', () => {
    expect(lookup('4915112345678')).toBeNull();
  });
});
