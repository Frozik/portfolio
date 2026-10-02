import { describe, expect, it } from 'vitest';

import { createNoise } from './noise';

const DAY = 86_400_000_000_000n;
const YEAR = 365n * DAY;

describe('noise over time', () => {
  it('gives the same series for the same seed and another for another seed', () => {
    const first = createNoise({ seed: 'a', period: YEAR });
    const again = createNoise({ seed: 'a', period: YEAR });
    const other = createNoise({ seed: 'b', period: YEAR });

    expect(first(100n * DAY)).toBe(again(100n * DAY));
    expect(first(100n * DAY)).not.toBe(other(100n * DAY));
  });

  it('stays near its centre', () => {
    const noise = createNoise({ seed: 'a', period: YEAR });

    for (let day = 0n; day < 365n; day += 1n) {
      expect(noise(day * DAY)).toBeGreaterThan(65);
      expect(noise(day * DAY)).toBeLessThan(135);
    }
  });

  it('is smooth: moments a second apart barely differ', () => {
    const noise = createNoise({ seed: 'a', period: YEAR });
    const moment = 100n * DAY;

    expect(Math.abs(noise(moment) - noise(moment + 1_000_000_000n))).toBeLessThan(0.01);
  });
});
