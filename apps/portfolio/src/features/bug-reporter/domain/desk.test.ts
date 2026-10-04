import { describe, expect, it } from 'vitest';

import { profitOf, totalBalance } from './desk';
import { generateDesk } from './generate-desk';

describe('desk', () => {
  it('generates the same desk for the same seed', () => {
    expect(generateDesk(7)).toEqual(generateDesk(7));
    expect(generateDesk(7).accounts[0]?.balance).not.toBe(generateDesk(8).accounts[0]?.balance);
  });

  it('signs the profit by the side of the position', () => {
    const base = { id: 'p', instrument: 'X', quantity: 10, averagePrice: 100, lastPrice: 110 };
    expect(profitOf({ ...base, side: 'long' })).toBe(100);
    expect(profitOf({ ...base, side: 'short' })).toBe(-100);
  });

  it('sums balances across accounts', () => {
    expect(totalBalance(generateDesk(1).accounts)).toBeGreaterThan(0);
  });
});
