export interface IOrderBookSequenceGapInfo {
  readonly instrument: string;
  readonly expectedUpdateId: number;
  readonly actualUpdateId: number;
  readonly lastEventTimeMs: number | undefined;
}

export class OrderBookSequenceGapError extends Error {
  readonly info: IOrderBookSequenceGapInfo;

  constructor(info: IOrderBookSequenceGapInfo) {
    super(
      `OrderBook sequence gap for ${info.instrument}: expected <= ${info.expectedUpdateId}, got ${info.actualUpdateId}`
    );
    this.name = 'OrderBookSequenceGapError';
    this.info = info;
  }
}

/**
 * Thrown when the upstream WebSocket observable completes cleanly — we
 * treat that as a reconnect trigger so the outer `retry` operator fires
 * (retry ignores `complete`, only reacts to error). Browsers often
 * deliver network drops as clean-close rather than error, which would
 * otherwise leave us silently frozen.
 */
export class OrderBookStreamClosedError extends Error {
  constructor() {
    super('Binance orderbook WebSocket stream closed unexpectedly');
    this.name = 'OrderBookStreamClosedError';
  }
}
