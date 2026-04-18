import type { IOrderbookSnapshot } from './types';

/**
 * Rebucket a raw orderbook snapshot onto a fixed price grid.
 *
 * Prices are floored (bids) or ceiled (asks) onto multiples of
 * `binUsd`, and volumes inside the same bin are summed. The returned
 * snapshot preserves bid-desc / ask-asc ordering so the downstream
 * `snapshotToLevels` packer can place bins directly into the
 * heatmap column without resorting.
 *
 * `binUsd <= 0` is treated as a no-op: the original snapshot is
 * returned untouched.
 */
export function aggregateSnapshotByBin(
  snapshot: IOrderbookSnapshot,
  binUsd: number
): IOrderbookSnapshot {
  if (binUsd <= 0) {
    return snapshot;
  }

  const bidsByBin = new Map<number, number>();
  for (const [price, volume] of snapshot.bids) {
    if (volume <= 0) {
      continue;
    }
    const bin = Math.floor(price / binUsd) * binUsd;
    bidsByBin.set(bin, (bidsByBin.get(bin) ?? 0) + volume);
  }

  const asksByBin = new Map<number, number>();
  for (const [price, volume] of snapshot.asks) {
    if (volume <= 0) {
      continue;
    }
    const bin = Math.ceil(price / binUsd) * binUsd;
    asksByBin.set(bin, (asksByBin.get(bin) ?? 0) + volume);
  }

  const aggregatedBids = Array.from(bidsByBin.entries())
    .map(([price, volume]) => [price, volume] as const)
    .sort(([priceA], [priceB]) => priceB - priceA);

  const aggregatedAsks = Array.from(asksByBin.entries())
    .map(([price, volume]) => [price, volume] as const)
    .sort(([priceA], [priceB]) => priceA - priceB);

  return {
    eventTimeMs: snapshot.eventTimeMs,
    bids: aggregatedBids,
    asks: aggregatedAsks,
  };
}
