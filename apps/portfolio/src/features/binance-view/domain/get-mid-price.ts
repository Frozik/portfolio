import type { IOrderbookSnapshot } from './types';

/**
 * Derive the mid-price of an orderbook snapshot.
 *
 * Returns `(bestBid + bestAsk) / 2` when both sides are present,
 * otherwise the single available best level, otherwise `fallback`.
 * Returns `undefined` when the snapshot has no levels and no fallback
 * is provided.
 */
export function getMidPrice(snapshot: IOrderbookSnapshot, fallback?: number): number | undefined {
  const bestBid = snapshot.bids.length > 0 ? snapshot.bids[0][0] : undefined;
  const bestAsk = snapshot.asks.length > 0 ? snapshot.asks[0][0] : undefined;
  if (bestBid !== undefined && bestAsk !== undefined) {
    return (bestBid + bestAsk) / 2;
  }
  return bestBid ?? bestAsk ?? fallback;
}
