import { describe, expect, it } from 'vitest';

import type { InstrumentSymbol } from '../domain/instruments';

import { findTickerPrice, parseExchangeInfoTickSize } from './binance-instrument-catalog';

const SOL = 'SOLUSDT' as InstrumentSymbol;

const TRADING_SYMBOL = {
  symbols: [
    {
      symbol: 'SOLUSDT',
      status: 'TRADING',
      filters: [
        { filterType: 'LOT_SIZE', stepSize: '0.00100000' },
        { filterType: 'PRICE_FILTER', minPrice: '0.01000000', tickSize: '0.01000000' },
      ],
    },
  ],
};

describe('parseExchangeInfoTickSize', () => {
  it('reads the price-filter tick size of a trading symbol', () => {
    expect(parseExchangeInfoTickSize(TRADING_SYMBOL)).toBe(0.01);
  });

  it('treats a halted symbol as not listed', () => {
    const halted = { symbols: [{ ...TRADING_SYMBOL.symbols[0], status: 'BREAK' }] };
    expect(parseExchangeInfoTickSize(halted)).toBeUndefined();
  });

  it('rejects malformed payloads', () => {
    expect(parseExchangeInfoTickSize({ symbols: [] })).toBeUndefined();
    expect(parseExchangeInfoTickSize('nope')).toBeUndefined();
  });
});

describe('findTickerPrice', () => {
  const tickers = [
    { symbol: 'ETHBTC', price: '0.03078000' },
    { symbol: 'SOLUSDT', price: '101.56000000' },
  ];

  it('finds the symbol in the full ticker list and parses its price', () => {
    expect(findTickerPrice(tickers, SOL)).toBe(101.56);
  });

  it('answers undefined for symbols the exchange does not list', () => {
    expect(findTickerPrice(tickers, 'FOOBARBAZ' as InstrumentSymbol)).toBeUndefined();
    expect(findTickerPrice({ symbol: 'SOLUSDT' }, SOL)).toBeUndefined();
  });
});
