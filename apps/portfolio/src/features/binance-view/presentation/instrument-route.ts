import type { InstrumentSymbol } from '../domain/instruments';

export function instrumentRoute(symbol: InstrumentSymbol): string {
  return `/binance/${symbol.toLowerCase()}`;
}
