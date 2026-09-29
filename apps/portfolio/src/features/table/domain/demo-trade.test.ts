import { generateTrades } from './demo-trade';

describe('generateTrades', () => {
  it('produces the same trades for the same seed, with ascending ids and times', () => {
    const first = generateTrades(50, 7);
    const second = generateTrades(50, 7);
    expect(first).toEqual(second);
    expect(first.map(trade => trade.id)).toEqual(
      Array.from({ length: 50 }, (_, index) => index + 1)
    );
    expect(first[1].time > first[0].time).toBe(true);
  });

  it('deals in whole quantities and prices in cents', () => {
    const trades = generateTrades(500);
    expect(trades.every(trade => Number.isInteger(trade.quantity) && trade.quantity > 0)).toBe(
      true
    );
    expect(trades.every(trade => trade.price === Number(trade.price.toFixed(2)))).toBe(true);
  });
});
