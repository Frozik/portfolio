type Price = string;
type Volume = string;

export interface IOrderBookUpdate {
  eventTimeMs: number;
  instrument: string;
  firstUpdateId: number;
  finalUpdateId: number;
  bids: [Price, Volume][];
  asks: [Price, Volume][];
}

export interface IOrderBookStateSnapshot {
  status: 'snapshot';
  instrument: string;
  lastUpdateId: number;
  bids: Map<Price, Volume>;
  asks: Map<Price, Volume>;
}

export interface IOrderBookStateFull {
  status: 'full';
  eventTimeMs: number;
  instrument: string;
  lastUpdateId: number;
  bids: Map<Price, Volume>;
  asks: Map<Price, Volume>;
}

export type OrderBookState = IOrderBookStateSnapshot | IOrderBookStateFull;
