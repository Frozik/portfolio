import { assert } from '@frozik/utils/assert/assert';
import { describe, expect, it } from 'vitest';

import type { InstrumentSymbol } from './instruments';
import { findCuratedInstrument, parseInstrumentSymbol } from './instruments';

function symbol(raw: string): InstrumentSymbol {
  const parsed = parseInstrumentSymbol(raw);
  assert(parsed !== undefined, `expected ${raw} to parse`);
  return parsed;
}

describe('parseInstrumentSymbol', () => {
  it('accepts any symbol-shaped segment in any case', () => {
    expect(parseInstrumentSymbol('solusdt')).toBe('SOLUSDT');
    expect(parseInstrumentSymbol('1inchusdt')).toBe('1INCHUSDT');
  });

  it('rejects segments that cannot be a Binance symbol', () => {
    expect(parseInstrumentSymbol('btc-usdt')).toBeUndefined();
    expect(parseInstrumentSymbol('x')).toBeUndefined();
    expect(parseInstrumentSymbol(undefined)).toBeUndefined();
  });
});

describe('findCuratedInstrument', () => {
  it('returns the tuned step for curated symbols and nothing for the rest', () => {
    expect(findCuratedInstrument(symbol('btcusdt'))?.aggregationQuoteStep).toBe(1.5);
    expect(findCuratedInstrument(symbol('avaxusdt'))).toBeUndefined();
  });
});
