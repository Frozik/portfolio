import { isNil } from 'lodash-es';

import { batchOfColumns, columnsOf } from '../../core/series/columns';
import type { TAggregateTime } from '../../core/series/point-run';
import type { IAxisDomain } from '../../core/viewport/axis-domain';
import type { IAxisMapping } from '../../core/viewport/axis-mapping';
import { toVirtualRange } from '../../core/viewport/axis-mapping';
import { cutColumns } from '../cuts/cut-columns';
import type { ISnapshotSource, ISnapshotWindow } from './source';

/**
 * A snapshot source with the cuts of the axis applied at its door: asked in
 * world coordinates, answering in virtual ones with nothing inside the cuts
 * left; the windows behind it never learn that anything was cut (sessions §5).
 */
export function cutSnapshotSource<TX>(
  source: ISnapshotSource<TX>,
  domain: IAxisDomain<TX>,
  mapping: IAxisMapping<TX>,
  aggregateTime: TAggregateTime
): ISnapshotSource<TX> {
  return {
    async fetch(request): Promise<ISnapshotWindow<TX>> {
      const answer = await source.fetch({
        ...request,
        from: mapping.toWorld(request.from, 'before'),
        to: mapping.toWorld(request.to, 'after'),
      });
      const columns = cutColumns(
        { domain, mapping, step: request.scale, aggregateTime },
        columnsOf(answer.data)
      );
      return {
        data: batchOfColumns<TX>(columns),
        range: isNil(answer.range) ? undefined : toVirtualRange(mapping, answer.range),
      };
    },
    subscribe: onChange =>
      source.subscribe(range =>
        onChange(isNil(range) ? undefined : toVirtualRange(mapping, range))
      ),
  };
}
