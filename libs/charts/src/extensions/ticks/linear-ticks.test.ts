import { describe, expect, it } from 'vitest';

import { linearTicks } from './linear-ticks';

describe('linearTicks', () => {
  it('puts ticks at round numbers, written with the decimals of their step', () => {
    const ticks = linearTicks().ticks({ start: 84.2, end: 116.7 }, 400);

    expect(ticks.map(tick => tick.label)).toEqual([
      '85.0',
      '90.0',
      '95.0',
      '100.0',
      '105.0',
      '110.0',
      '115.0',
    ]);
  });

  it('follows the magnitude of the range down to fractions', () => {
    const ticks = linearTicks().ticks({ start: 0.0012, end: 0.0019 }, 400);

    expect(ticks[0].label).toBe('0.00120');
    expect(ticks.every(tick => tick.position >= 0.0012 && tick.position <= 0.0019)).toBe(true);
  });

  it('drops ticks whose labels would overlap on a short axis', () => {
    const tall = linearTicks().ticks({ start: 0, end: 100 }, 400);
    const short = linearTicks().ticks({ start: 0, end: 100 }, 80);

    expect(short.length).toBeLessThan(tall.length);
    expect(short.length).toBeGreaterThan(0);
  });

  it('gives one tick to a range of no height', () => {
    expect(linearTicks().ticks({ start: 5, end: 5 }, 400)).toEqual([{ position: 5, label: '5.0' }]);
  });

  it('writes any value with the decimals the ticks of the range carry', () => {
    expect(linearTicks().format(101.23456, { start: 84.2, end: 116.7 }, 400)).toBe('101.2');
    expect(linearTicks().format(95.1234, { start: 94.4, end: 96.1 }, 400)).toBe('95.12');
  });
});
