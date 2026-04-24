import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import type { Observable } from 'rxjs';
import { from, of } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { concatMap, endWith, filter, map, scan, switchMap } from 'rxjs/operators';

import type { IRawDepthSnapshot, IRawOrderBookUpdate } from './binance-raw.types';
import { OrderBookSequenceGapError } from './orderbook-errors';
import type { IOrderbookSnapshotData } from './orderbook-mapper';
import {
  isOrderBookUpdate,
  mapOrderBookSnapshotData,
  mapOrderBookUpdateData,
} from './orderbook-mapper';
import type { IOrderBookStateFull, OrderBookState } from './orderbook-state';

export function buildOrderBookState$(params: {
  rawUpdates$: Observable<IRawOrderBookUpdate>;
  restUrl: string;
  instrument: string;
  depth: number;
}): Observable<IOrderbookSnapshotData> {
  const { rawUpdates$, restUrl, instrument, depth } = params;

  const fetchSnapshot$: Observable<IRawDepthSnapshot> = fromFetch(restUrl).pipe(
    switchMap(response => {
      if (!response.ok) {
        throw new Error(
          `Order book REST snapshot failed: ${response.status} ${response.statusText} for ${restUrl}`
        );
      }
      return from(response.json()) as Observable<IRawDepthSnapshot>;
    })
  );

  return rawUpdates$.pipe(
    map(data => mapOrderBookUpdateData(data)),
    concatMap((data, index) =>
      index === 0
        ? fetchSnapshot$.pipe(
            map(snapshot => {
              assert(
                !isNil(snapshot.bids) && !isNil(snapshot.asks),
                `Invalid order book snapshot response from ${restUrl}: missing bids or asks`
              );
              return snapshot;
            }),
            endWith(data)
          )
        : of(data)
    ),
    scan((state: OrderBookState | undefined, event): OrderBookState => {
      if (!isOrderBookUpdate(event)) {
        return {
          status: 'snapshot',
          instrument: instrument.toUpperCase(),
          lastUpdateId: event.lastUpdateId,
          bids: new Map(event.bids.map(bid => [bid[0], bid[1]])),
          asks: new Map(event.asks.map(ask => [ask[0], ask[1]])),
        };
      }

      assert(!isNil(state), 'State is not initialized');

      if (event.finalUpdateId <= state.lastUpdateId) {
        assert(state.status === 'snapshot', 'Wrong update after fully constructed snapshot');
        return state;
      }

      if (event.firstUpdateId > state.lastUpdateId + 1) {
        throw new OrderBookSequenceGapError({
          instrument: state.instrument,
          expectedUpdateId: state.lastUpdateId + 1,
          actualUpdateId: event.firstUpdateId,
          lastEventTimeMs: state.status === 'full' ? state.eventTimeMs : undefined,
        });
      }

      const newBids = new Map(state.bids);
      const newAsks = new Map(state.asks);

      for (const [price, quantity] of event.bids) {
        if (Number.parseFloat(quantity) === 0) {
          newBids.delete(price);
        } else {
          newBids.set(price, quantity);
        }
      }

      for (const [price, quantity] of event.asks) {
        if (Number.parseFloat(quantity) === 0) {
          newAsks.delete(price);
        } else {
          newAsks.set(price, quantity);
        }
      }

      return {
        status: 'full',
        eventTimeMs: event.eventTimeMs,
        instrument: state.instrument,
        lastUpdateId: event.finalUpdateId,
        bids: newBids,
        asks: newAsks,
      };
    }, undefined),
    filter((state): state is IOrderBookStateFull => !isNil(state) && state.status === 'full'),
    map(state => mapOrderBookSnapshotData(state, depth))
  );
}
