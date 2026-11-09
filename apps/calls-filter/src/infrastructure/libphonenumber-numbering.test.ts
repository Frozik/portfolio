import type { TE164Digits } from '../contexts/phone/domain/caller';
import type { TCountryCode } from '../contexts/phone/domain/dialing-region';
import { LIBPHONENUMBER_NUMBERING } from './libphonenumber-numbering';

describe('the numbering plan', () => {
  it('knows how a country dials nationally', () => {
    expect(LIBPHONENUMBER_NUMBERING.region('NL' as TCountryCode)).toEqual({
      country: 'NL',
      callingCode: '31',
      nationalPrefix: '0',
    });
    expect(LIBPHONENUMBER_NUMBERING.region('RU' as TCountryCode)).toMatchObject({
      callingCode: '7',
      nationalPrefix: '8',
    });
    expect(LIBPHONENUMBER_NUMBERING.region('IT' as TCountryCode)).toMatchObject({
      callingCode: '39',
      nationalPrefix: null,
    });
  });

  it('reads a national number as dialled from home', () => {
    expect(LIBPHONENUMBER_NUMBERING.parse('06 12 34 56 78', 'NL' as TCountryCode)).toBe(
      '31612345678'
    );
    expect(LIBPHONENUMBER_NUMBERING.parse('+7 921 123-45-67', 'NL' as TCountryCode)).toBe(
      '79211234567'
    );
    expect(LIBPHONENUMBER_NUMBERING.parse('hello', 'NL' as TCountryCode)).toBeNull();
  });

  it("finds toll-free numbers by each country's own plan, not by one prefix", () => {
    const typeOf = (digits: string) => LIBPHONENUMBER_NUMBERING.traits(digits as TE164Digits).type;
    expect(typeOf('3180012345')).toBe('toll-free');
    expect(typeOf('78001234567')).toBe('toll-free');
    expect(typeOf('18002345678')).toBe('toll-free');
    expect(typeOf('358800123456')).toBe('toll-free');
    expect(typeOf('79211234567')).not.toBe('toll-free');
  });

  it('tells the country and the kind of a number', () => {
    expect(LIBPHONENUMBER_NUMBERING.traits('319001234567' as TE164Digits)).toEqual({
      country: 'NL',
      type: 'premium-rate',
    });
    expect(LIBPHONENUMBER_NUMBERING.traits('31612345678' as TE164Digits)).toEqual({
      country: 'NL',
      type: 'mobile',
    });
  });
});
