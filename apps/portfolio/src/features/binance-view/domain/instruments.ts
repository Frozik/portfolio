/**
 * Selectable Binance spot instruments. Each carries its own
 * `aggregationQuoteStep` — the heatmap price-bin height — because a single
 * fixed step cannot serve coins three orders of magnitude apart in price
 * (BTC ~$100k vs DOGE ~$0.2). The steps are scaled to roughly the same
 * fraction of price as BTC's tuned 1.5 and kept as a multiple of each
 * symbol's tick size.
 */
export interface IInstrumentOption {
  readonly symbol: string;
  readonly aggregationQuoteStep: number;
}

export const BINANCE_INSTRUMENTS: readonly IInstrumentOption[] = [
  { symbol: 'BTCUSDT', aggregationQuoteStep: 1.5 },
  { symbol: 'ETHUSDT', aggregationQuoteStep: 0.05 },
  { symbol: 'SOLUSDT', aggregationQuoteStep: 0.01 },
  { symbol: 'DOGEUSDT', aggregationQuoteStep: 0.0001 },
];

export const DEFAULT_INSTRUMENT: IInstrumentOption = BINANCE_INSTRUMENTS[0];

export function findInstrument(symbol: string): IInstrumentOption {
  return BINANCE_INSTRUMENTS.find(option => option.symbol === symbol) ?? DEFAULT_INSTRUMENT;
}

export function instrumentDbName(symbol: string): string {
  return `binance-orderbook-${symbol}`;
}
