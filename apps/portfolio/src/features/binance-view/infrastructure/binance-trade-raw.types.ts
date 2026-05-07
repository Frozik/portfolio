/**
 * Raw `@aggTrade` event from Binance combined-stream WebSocket.
 *
 * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#aggregate-trade-streams
 *
 * Numeric fields `p` and `q` are decimal **strings** (Binance convention
 * — preserves precision); we parse with `Number.isFinite` validation in
 * the mapper (see `mapRawAggTradeToITrade`). `tradeId` (`a`) is a
 * `number` per the WS payload — we additionally check
 * `Number.isInteger`.
 */
export interface IRawAggTrade {
  /** Event type — always `'aggTrade'`. */
  readonly e: 'aggTrade';
  /** Event time (ms). */
  readonly E: number;
  /** Trade time (ms) — chart X-axis. */
  readonly T: number;
  /** Symbol. */
  readonly s: string;
  /** Aggregate trade id. */
  readonly a: number;
  /** Price (decimal string). */
  readonly p: string;
  /** Quantity (decimal string). */
  readonly q: string;
  /**
   * `isBuyerMaker` — `true` → taker-sell aggression (red),
   * `false` → taker-buy aggression (green).
   */
  readonly m: boolean;
  /** Vestigial best-price-match flag — ignored. */
  readonly M: boolean;
  /** First trade id in aggregate. */
  readonly f: number;
  /** Last trade id in aggregate. */
  readonly l: number;
}

/**
 * Combined-stream wrapper payload for `wss://stream.binance.com:9443/stream`.
 * Each event is wrapped in `{ stream, data }` where `stream` identifies
 * the originating sub-stream (e.g. `'btcusdt@aggTrade'`) and `data` is
 * the actual event payload.
 */
export interface ICombinedStreamMessage<TData> {
  readonly stream: string;
  readonly data: TData;
}
