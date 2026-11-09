import type { INumberingMask } from './gen/numbering-codes';
import { numberingDetailsOf } from './numbering-details';

const RUSSIA: INumberingMask = { mask: '+7*', countryCode: 'RU' };
const BEELINE: INumberingMask = {
  mask: '+7963*',
  countryCode: 'RU',
  networkOperatorCode: 'beeline',
  stateCodes: ['moscow', 'moscow-oblast'],
};
const KIROV: INumberingMask = {
  mask: '+7963000*',
  countryCode: 'RU',
  stateCodes: ['kirov-oblast'],
};
const FREEPHONE: INumberingMask = { mask: '+800*', serviceCode: 'international-freephone' };

describe('what a number says about itself', () => {
  it('takes the deepest region and keeps the operator a wider mask named', () => {
    expect(numberingDetailsOf([RUSSIA, BEELINE, KIROV])).toEqual({
      country: 'RU',
      states: ['kirov-oblast'],
      operator: 'beeline',
      service: null,
    });
  });

  it('knows only the country when nothing deeper covers the number', () => {
    expect(numberingDetailsOf([RUSSIA])).toEqual({
      country: 'RU',
      states: [],
      operator: null,
      service: null,
    });
  });

  it('names a service that belongs to no country', () => {
    expect(numberingDetailsOf([FREEPHONE])?.service).toBe('international-freephone');
  });

  it('knows nothing of a number no country code covers', () => {
    expect(numberingDetailsOf([])).toBeNull();
  });
});
