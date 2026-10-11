import * as fc from 'fast-check';

import { formatCsv, parseCsv } from './csv';

describe('CSV', () => {
  it('reads quoted values with separators, doubled quotes and line breaks', () => {
    const text = 'name,note\r\n"Bank, main","said ""hi""\nsecond line"\r\n';

    expect(parseCsv(text)).toEqual([
      ['name', 'note'],
      ['Bank, main', 'said "hi"\nsecond line'],
    ]);
  });

  it('drops a byte order mark and skips blank lines', () => {
    expect(parseCsv('﻿a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps empty values, at the end of a row too', () => {
    expect(parseCsv('a,,\n"",b,')).toEqual([
      ['a', '', ''],
      ['', 'b', ''],
    ]);
  });

  it('reads back whatever it wrote', () => {
    const row = fc.array(fc.string(), { minLength: 1, maxLength: 5 });
    fc.assert(
      fc.property(
        fc
          .array(row, { minLength: 1, maxLength: 5 })
          .filter(rows => rows.every(cells => cells.length > 1 || cells[0] !== '')),
        rows => {
          expect(parseCsv(formatCsv(rows))).toEqual(rows);
        }
      )
    );
  });
});
