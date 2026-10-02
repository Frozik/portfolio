import { describe, expect, it } from 'vitest';

import { BLUE, GREY, RED } from './palette';
import { colorByValue, lineSizeByValue } from './value-bands';

describe('value bands', () => {
  it('colours a value by the band it falls in, a threshold belonging to the band below', () => {
    expect(colorByValue(120)).toBe(RED);
    expect(colorByValue(110)).not.toBe(RED);
    expect(colorByValue(102)).toBe(GREY);
    expect(colorByValue(50)).toBe(BLUE);
  });

  it('draws higher values thicker', () => {
    expect(lineSizeByValue(120)).toBeGreaterThan(lineSizeByValue(102));
    expect(lineSizeByValue(102)).toBeGreaterThan(lineSizeByValue(50));
  });
});
