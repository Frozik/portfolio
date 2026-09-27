import { formatNumber } from './formatNumber';

describe('formatNumber', () => {
  it('rounds to the digits and groups thousands by default', () => {
    expect(formatNumber(1234567.891, { locale: 'en-US', digits: 2 })).toBe('1,234,567.89');
    expect(formatNumber(1234.5, { locale: 'en-US', digits: 2, grouping: false })).toBe('1234.50');
  });

  it('formats bigints and treats missing values as empty', () => {
    expect(formatNumber(12345678901234567890n, { locale: 'en-US' })).toBe(
      '12,345,678,901,234,567,890'
    );
    expect(formatNumber(null, { empty: '–' })).toBe('–');
    expect(formatNumber(Number.NaN)).toBe('');
  });
});
