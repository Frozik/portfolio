import type { ISO } from '@frozik/utils/date/types';
import { Temporal } from 'temporal-polyfill';

import { seededRandom } from './random';

type TTradeSide = 'buy' | 'sell';
export type TTradeStatus = 'filled' | 'partial' | 'cancelled';

export interface IDemoTrade {
  readonly id: number;
  readonly time: ISO;
  readonly symbol: string;
  readonly side: TTradeSide;
  readonly price: number;
  readonly quantity: number;
  readonly venue: string;
  readonly status: TTradeStatus;
  readonly note: string;
}

const SYMBOLS: readonly { readonly symbol: string; readonly price: number }[] = [
  { symbol: 'BTC-USDT', price: 64_250 },
  { symbol: 'ETH-USDT', price: 3_410 },
  { symbol: 'SOL-USDT', price: 148 },
  { symbol: 'ADA-USDT', price: 0.47 },
  { symbol: 'XRP-USDT', price: 0.61 },
  { symbol: 'DOT-USDT', price: 7.2 },
];
const VENUES: readonly string[] = ['Binance', 'OKX', 'Bybit', 'Kraken'];
const STATUSES: readonly TTradeStatus[] = ['filled', 'filled', 'filled', 'partial', 'cancelled'];
const NOTES: readonly string[] = [
  '',
  'Hedge leg',
  'Rebalance after funding',
  'Manual fill, desk confirmed by phone; awaiting settlement report from the venue',
  'Iceberg child order',
];
const START = Temporal.Instant.from('2026-09-27T08:00:00Z');
const SECONDS_BETWEEN_TRADES = 7;
const PRICE_JITTER = 0.004;
const MAX_QUANTITY = 12;
const QUANTITY_DECIMALS = 3;

export function notionalOf(trade: IDemoTrade): number {
  return trade.price * trade.quantity;
}

export function generateTrades(count: number, seed = 1): readonly IDemoTrade[] {
  const random = seededRandom(seed);
  const pick = <TItem>(items: readonly TItem[]): TItem =>
    items[Math.floor(random() * items.length)];
  return Array.from({ length: count }, (_, index) => {
    const instrument = pick(SYMBOLS);
    const quantity =
      Number((random() * MAX_QUANTITY).toFixed(QUANTITY_DECIMALS)) + 1 / 10 ** QUANTITY_DECIMALS;
    return {
      id: index + 1,
      time: START.add({ seconds: index * SECONDS_BETWEEN_TRADES }).toString() as ISO,
      symbol: instrument.symbol,
      side: random() > 0.5 ? 'buy' : 'sell',
      price: instrument.price * (1 + (random() - 0.5) * PRICE_JITTER),
      quantity,
      venue: pick(VENUES),
      status: pick(STATUSES),
      note: pick(NOTES),
    };
  });
}
