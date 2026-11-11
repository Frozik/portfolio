import { parsePlainDate } from './plain-date';
import { parseYearMonth } from './year-month';

describe('an expiry', () => {
  it('takes a month written with a slash, a dot or a dash, and a two- or four-digit year', () => {
    expect(
      ['11/27', '11.27', '11-27', '11/2027', '11.2027', ' 11 / 27 ', '2027-11'].map(
        value => parseYearMonth(value)?.toString() ?? null
      )
    ).toEqual(Array.from({ length: 7 }, () => '2027-11'));
  });

  it('calls a full day no month: it is a document’s expiry, and keeps its day', () => {
    expect({
      month: parseYearMonth('10.11.2027'),
      day: parsePlainDate('10.11.2027')?.toString(),
    }).toEqual({ month: null, day: '2027-11-10' });
  });
});
