import { detectCardNetwork, groupCardNumber } from './card-network';
import { hasValidLuhnChecksum } from './validation/luhn';

describe('payment networks', () => {
  it.each([
    ['4111111111111111', 'visa'],
    ['5555555555554444', 'mastercard'],
    ['2223000048400011', 'mastercard'],
    ['378282246310005', 'american-express'],
    ['6011111111111117', 'discover'],
    ['3530111333300000', 'jcb'],
    ['30569309025904', 'diners-club'],
    ['6200000000000005', 'unionpay'],
    ['6304000000000000', 'maestro'],
    ['2200000000000004', 'mir'],
    ['2204123456789015', 'mir'],
    ['6362970000457013', 'elo'],
  ])('recognises %s as %s, a number that also passes Luhn', (digits, network) => {
    expect(detectCardNetwork(digits)?.network).toBe(network);
    expect(hasValidLuhnChecksum(digits)).toBe(true);
  });

  it('knows no network for a number no prefix table claims', () => {
    expect(detectCardNetwork('9999999999999999')).toBeNull();
  });

  it('groups the digits the way the network prints them', () => {
    expect(groupCardNumber('4111111111111111')).toBe('4111 1111 1111 1111');
    expect(groupCardNumber('378282246310005')).toBe('3782 822463 10005');
  });
});

describe('Luhn check digit', () => {
  it.each(['4111111111111112', '1234', '41111111111a1111', ''])('refuses %s', digits => {
    expect(hasValidLuhnChecksum(digits)).toBe(false);
  });
});
