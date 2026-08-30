import { describe, expect, it } from 'vitest';

import { parseElevationCsv } from './parse-elevation-csv';

describe('parseElevationCsv', () => {
  it('reads a triple per line whatever separates the values', () => {
    const { marks, skippedLineNumbers } = parseElevationCsv(
      ['1;2;3', '4,5,6', '7\t8\t9', '10 11 12'].join('\n')
    );

    expect(skippedLineNumbers).toEqual([]);
    expect(marks).toEqual([
      { position: { x: 1, y: 2 }, elevation: 3 },
      { position: { x: 4, y: 5 }, elevation: 6 },
      { position: { x: 7, y: 8 }, elevation: 9 },
      { position: { x: 10, y: 11 }, elevation: 12 },
    ]);
  });

  it('keeps decimals and negative elevations', () => {
    const { marks } = parseElevationCsv('12.5; 8.25; -1.75');

    expect(marks).toEqual([{ position: { x: 12.5, y: 8.25 }, elevation: -1.75 }]);
  });

  it('ignores blank lines and carriage returns', () => {
    const { marks, skippedLineNumbers } = parseElevationCsv('1;2;3\r\n\r\n4;5;6\r\n');

    expect(marks).toHaveLength(2);
    expect(skippedLineNumbers).toEqual([]);
  });

  it('reports the lines it could not read', () => {
    const { marks, skippedLineNumbers } = parseElevationCsv(
      ['x;y;z', '1;2;3', '4;5', '6;7;8;9', 'nine;ten;eleven'].join('\n')
    );

    expect(marks).toEqual([{ position: { x: 1, y: 2 }, elevation: 3 }]);
    expect(skippedLineNumbers).toEqual([1, 3, 4, 5]);
  });

  it('reads nothing out of an empty paste', () => {
    expect(parseElevationCsv('   \n\n')).toEqual({ marks: [], skippedLineNumbers: [] });
  });
});
