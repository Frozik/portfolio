import type { OperatorFunction } from 'rxjs';
import { Observable } from 'rxjs';

import type { IQuantizerScheduler } from '../domain/snapshot-quantizer';
import { SnapshotQuantizer } from '../domain/snapshot-quantizer';
import type { IOrderbookSnapshot, IQuantizedSnapshot } from '../domain/types';

export interface IQuantizeBySecondOptions {
  readonly now?: () => number;
  readonly scheduler?: IQuantizerScheduler;
  readonly maxInterpolatedSnapshots?: number;
}

/**
 * RxJS operator: convert a stream of raw `IOrderbookSnapshot` events
 * into a stream of second-aligned `IQuantizedSnapshot`s, repeating the
 * last snapshot (with `isInterpolated: true`) into empty 1-second
 * buckets up to the configured cap.
 *
 * The quantizer's scheduler + clock can be injected for tests; the
 * default uses `globalThis.setTimeout` and `nowEpochMs` (Temporal).
 */
export function quantizeBySecond(
  options: IQuantizeBySecondOptions = {}
): OperatorFunction<IOrderbookSnapshot, IQuantizedSnapshot> {
  return (source: Observable<IOrderbookSnapshot>): Observable<IQuantizedSnapshot> =>
    new Observable<IQuantizedSnapshot>(subscriber => {
      const quantizer = new SnapshotQuantizer({
        onEmit: snapshot => subscriber.next(snapshot),
        now: options.now,
        scheduler: options.scheduler,
        maxInterpolatedSnapshots: options.maxInterpolatedSnapshots,
      });

      const subscription = source.subscribe({
        next: snapshot => quantizer.push(snapshot),
        error: error => subscriber.error(error),
        complete: () => subscriber.complete(),
      });

      return () => {
        quantizer.dispose();
        subscription.unsubscribe();
      };
    });
}
