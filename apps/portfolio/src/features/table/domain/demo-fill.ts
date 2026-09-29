import type { ISO } from '@frozik/utils/date/types';
import { Temporal } from 'temporal-polyfill';

import type { IDemoTrade } from './demo-trade';
import { seededRandom } from './random';

export interface IDemoFill {
  readonly id: string;
  readonly time: ISO;
  readonly price: number;
  readonly quantity: number;
  readonly venue: string;
}

const MAX_FILLS = 4;
const FILL_PRICE_JITTER = 0.001;
const SECONDS_BETWEEN_FILLS = 2;
const FILL_PRICE_DECIMALS = 2;

/** The executions a trade was assembled from; deterministic per trade so the detail is stable. */
export function fillsOf(trade: IDemoTrade): readonly IDemoFill[] {
  if (trade.status === 'cancelled') {
    return [];
  }
  const random = seededRandom(trade.id);
  const count = Math.min(trade.quantity, 1 + Math.floor(random() * MAX_FILLS));
  const share = Math.floor(trade.quantity / count);
  const remainder = trade.quantity - share * count;
  const start = Temporal.Instant.from(trade.time);
  return Array.from({ length: count }, (_, index) => ({
    id: `${trade.id}:${index + 1}`,
    time: start.add({ seconds: index * SECONDS_BETWEEN_FILLS }).toString() as ISO,
    price: Number(
      (trade.price * (1 + (random() - 0.5) * FILL_PRICE_JITTER)).toFixed(FILL_PRICE_DECIMALS)
    ),
    quantity: share + (index < remainder ? 1 : 0),
    venue: trade.venue,
  }));
}
