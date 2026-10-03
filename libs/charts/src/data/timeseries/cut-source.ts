import { isNil } from 'lodash-es';

import { batchOfColumns, columnsOf } from '../../core/series/columns';
import type { TAggregateTime } from '../../core/series/point-run';
import type { ICandle, IPoint, TBatch } from '../../core/series/shape';
import type { IAxisDomain } from '../../core/viewport/axis-domain';
import type { IAxisMapping } from '../../core/viewport/axis-mapping';
import type { ICutting } from '../cuts/cut-columns';
import { cutColumns } from '../cuts/cut-columns';
import { CutFetcher } from './cut-fetch';
import type { ITimeseriesSource } from './source';

/**
 * A source of time with the cuts of the axis applied at its door: asked in
 * world time, answering in virtual time with nothing inside the cuts left.
 * The channel behind it never learns that anything was cut (sessions §5).
 */
export function cutTimeseriesSource(
  source: ITimeseriesSource,
  domain: IAxisDomain<bigint>,
  mapping: IAxisMapping<bigint>,
  aggregateTime: TAggregateTime,
  requestWorth: number
): ITimeseriesSource {
  const cuttingAt = (request: { readonly scale: bigint }): ICutting<bigint> => ({
    domain,
    mapping,
    step: Number(request.scale),
    aggregateTime,
  });

  const cut = (cutting: ICutting<bigint>, batch: TBatch): TBatch =>
    batchOfColumns(cutColumns(cutting, columnsOf(batch)));

  const cutElement = (
    cutting: ICutting<bigint>,
    element: IPoint | ICandle | undefined
  ): IPoint | ICandle | undefined => {
    if (isNil(element)) {
      return undefined;
    }
    const columns = cutColumns(
      cutting,
      columnsOf(
        'value' in element
          ? { shape: 'point', points: [element] }
          : { shape: 'candle', candles: [element] }
      )
    );
    return columns.length === 0 ? undefined : { ...element, x: mapping.toVirtual(element.x) };
  };

  const fetcher = new CutFetcher({ source, domain, mapping, aggregateTime, requestWorth });

  return {
    async fetch(request): Promise<TBatch> {
      return batchOfColumns(await fetcher.fetch(request));
    },
    subscribe(request): VoidFunction {
      const cutting = cuttingAt(request);
      const { onPending } = request;
      return source.subscribe({
        ...request,
        onStart: since => request.onStart(mapping.toVirtual(since)),
        onBatch: batch => request.onBatch(cut(cutting, batch)),
        onPending: isNil(onPending)
          ? undefined
          : pending => onPending(cutElement(cutting, pending)),
      });
    },
  };
}
