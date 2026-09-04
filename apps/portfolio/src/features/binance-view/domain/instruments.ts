import type { Opaque } from '@frozik/utils/types/base';
import { isNil } from 'lodash-es';

/** A Binance spot symbol in exchange form (`BTCUSDT`); minted only by {@link parseInstrumentSymbol}. */
export type InstrumentSymbol = Opaque<'InstrumentSymbol', string>;

/** An instrument the chart can show: its symbol and the heatmap price-bin height. */
export interface IInstrument {
  readonly symbol: InstrumentSymbol;
  readonly aggregationQuoteStep: number;
}

const SYMBOL_PATTERN = /^[A-Z0-9]{2,20}$/;

/** Accepts a route segment in any case as long as it has the shape of a Binance symbol. */
export function parseInstrumentSymbol(raw: string | undefined): InstrumentSymbol | undefined {
  if (isNil(raw)) {
    return undefined;
  }
  const normalized = raw.toUpperCase();
  return SYMBOL_PATTERN.test(normalized) ? (normalized as InstrumentSymbol) : undefined;
}

function curated(symbol: string, aggregationQuoteStep: number): IInstrument {
  return { symbol: symbol as InstrumentSymbol, aggregationQuoteStep };
}

/**
 * Instruments offered in the selector, each with a hand-tuned
 * `aggregationQuoteStep`: a single fixed step cannot serve coins three
 * orders of magnitude apart in price. Any other symbol is resolved at
 * runtime from the exchange listing (`deriveAggregationQuoteStep`).
 */
export const CURATED_INSTRUMENTS: readonly IInstrument[] = [
  curated('BTCUSDT', 1.5),
  curated('ETHUSDT', 0.05),
  curated('SOLUSDT', 0.01),
  curated('DOGEUSDT', 0.0001),
];

export const DEFAULT_INSTRUMENT: IInstrument = CURATED_INSTRUMENTS[0];

export function findCuratedInstrument(symbol: InstrumentSymbol): IInstrument | undefined {
  return CURATED_INSTRUMENTS.find(candidate => candidate.symbol === symbol);
}

export function instrumentDbName(symbol: InstrumentSymbol): string {
  return `binance-orderbook-${symbol}`;
}
