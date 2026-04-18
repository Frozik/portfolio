import { isObject } from 'lodash-es';

import type { UnixTimeMs } from '../domain/types';

import type { IRawDepthSnapshot, IRawOrderBookUpdate } from './binance-raw.types';
import type { IOrderBookStateFull, IOrderBookUpdate } from './orderbook-state';

export interface IOrderbookSnapshotData {
  readonly eventTimeMs: UnixTimeMs;
  readonly instrument: string;
  readonly bids: ReadonlyArray<readonly [price: number, volume: number]>;
  readonly asks: ReadonlyArray<readonly [price: number, volume: number]>;
}

export function mapOrderBookUpdateData(data: IRawOrderBookUpdate): IOrderBookUpdate {
  return {
    instrument: data.s,
    eventTimeMs: data.E,
    firstUpdateId: data.U,
    finalUpdateId: data.u,
    bids: data.b,
    asks: data.a,
  };
}

export function mapOrderBookSnapshotData(
  state: IOrderBookStateFull,
  depth: number
): IOrderbookSnapshotData {
  const sortedBids = Array.from(state.bids.entries())
    .map(([price, volume]) => [Number.parseFloat(price), Number.parseFloat(volume)] as const)
    .sort(([priceA], [priceB]) => priceB - priceA)
    .slice(0, depth);

  const sortedAsks = Array.from(state.asks.entries())
    .map(([price, volume]) => [Number.parseFloat(price), Number.parseFloat(volume)] as const)
    .sort(([priceA], [priceB]) => priceA - priceB)
    .slice(0, depth);

  return {
    eventTimeMs: state.eventTimeMs as UnixTimeMs,
    instrument: state.instrument,
    bids: sortedBids,
    asks: sortedAsks,
  };
}

export function isOrderBookUpdate(
  event: IRawDepthSnapshot | IOrderBookUpdate
): event is IOrderBookUpdate {
  return isObject(event) && 'firstUpdateId' in event && 'finalUpdateId' in event;
}
