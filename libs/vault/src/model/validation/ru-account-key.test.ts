import { hasValidRussianAccountKey, isRussianAccountShape } from './ru-account-key';

describe('Russian bank account key', () => {
  it.each([
    ['30101810400000000225', '044525225', 'Sberbank correspondent account'],
    ['30101810145250000974', '044525974', 'T-Bank correspondent account'],
    ['30101810200000000593', '044525593', 'Alfa-Bank correspondent account'],
    ['40817810438000000001', '044525225', 'a settlement account at Sberbank'],
  ])('accepts %s with BIC %s (%s)', (account, bic) => {
    expect(hasValidRussianAccountKey(account, bic)).toBe(true);
  });

  it('refuses a mistyped digit and an account checked against another bank', () => {
    expect(hasValidRussianAccountKey('30101810400000000226', '044525225')).toBe(false);
    expect(hasValidRussianAccountKey('30101810400000000225', '044030653')).toBe(false);
  });

  it('reads a clearing-currency letter in the sixth position', () => {
    expect(isRussianAccountShape('40702A10000000000001')).toBe(true);
    expect(isRussianAccountShape('4070281000000000000')).toBe(false);
    expect(isRussianAccountShape('407028100000000000Z1')).toBe(false);
  });
});
