import { BANK_CODE_SCHEMES, hasValidAbaChecksum } from './bank-codes';

describe('national bank codes', () => {
  it.each([
    ['011000015', 'Federal Reserve Bank of Boston'],
    ['021000021', 'JPMorgan Chase, New York'],
    ['026009593', 'Bank of America'],
    ['121000248', 'Wells Fargo'],
    ['322271627', 'JPMorgan Chase, California'],
  ])('accepts the US routing number %s (%s)', routing => {
    expect(hasValidAbaChecksum(routing)).toBe(true);
  });

  it.each(['021000022', '123456789', '02100002', '02100002a'])(
    'refuses the routing number %s',
    routing => {
      expect(hasValidAbaChecksum(routing)).toBe(false);
    }
  );

  it.each([
    ['aba-routing', '021-000-021', '021000021', true],
    ['sort-code', '20-00-00', '200000', true],
    ['sort-code', '20-00-0', '20000', false],
    ['bsb', '062-000', '062000', true],
    ['ifsc', 'hdfc0000001', 'HDFC0000001', true],
    ['ifsc', 'HDFC1000001', 'HDFC1000001', false],
    ['ca-routing', '000312345', '000312345', true],
    ['ru-bic', '044525225', '044525225', true],
    ['ru-bic', '024525225', '024525225', false],
  ] as const)('reads %s "%s" as "%s", valid: %s', (scheme, typed, stored, valid) => {
    const row = BANK_CODE_SCHEMES[scheme];

    expect(row.normalize(typed)).toBe(stored);
    expect(row.isValid(stored)).toBe(valid);
  });

  it('shows a sort code and a BSB the way banks print them', () => {
    expect(BANK_CODE_SCHEMES['sort-code'].format('200000')).toBe('20-00-00');
    expect(BANK_CODE_SCHEMES.bsb.format('062000')).toBe('062-000');
  });
});
