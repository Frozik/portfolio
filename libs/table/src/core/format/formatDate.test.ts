import { Temporal } from 'temporal-polyfill';

import { formatDate } from './formatDate';

describe('formatDate', () => {
  it('formats an ISO instant in the requested zone and style', () => {
    expect(
      formatDate('2026-03-05T14:07:09Z', {
        locale: 'en-GB',
        timeZone: 'UTC',
        style: 'datetimeSeconds',
      })
    ).toBe('05/03/2026, 14:07:09');
    expect(
      formatDate('2026-03-05T14:07:09Z', {
        locale: 'en-GB',
        timeZone: 'Europe/Moscow',
        style: 'time',
      })
    ).toBe('17:07:09');
  });

  it('formats plain dates without a time and Temporal values directly', () => {
    expect(formatDate('2026-03-05', { locale: 'en-GB' })).toBe('05/03/2026');
    expect(formatDate(Temporal.PlainDate.from('2026-12-24'), { locale: 'en-GB' })).toBe(
      '24/12/2026'
    );
  });

  it('returns the empty text for missing values', () => {
    expect(formatDate(undefined, { empty: '—' })).toBe('—');
    expect(formatDate('')).toBe('');
  });
});
