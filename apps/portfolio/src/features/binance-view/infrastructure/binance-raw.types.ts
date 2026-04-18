// See: https://developers.binance.com/docs/binance-spot-api-docs

type Level = [price: string, qty: string];

export interface IRawDepthSnapshot {
  lastUpdateId: number;
  bids: Level[];
  asks: Level[];
}

export interface IRawOrderBookUpdate {
  e: 'depthUpdate';
  /** Event time (ms). */
  E: number;
  /** Symbol. */
  s: string;
  /** First update ID in event. */
  U: number;
  /** Final update ID in event. */
  u: number;
  /** Bids: [price, qty], qty="0" removes level. */
  b: Level[];
  /** Asks: [price, qty]. */
  a: Level[];
}
