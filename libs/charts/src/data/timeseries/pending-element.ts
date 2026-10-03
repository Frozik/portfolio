import { isNil } from 'lodash-es';

import type { TColumns } from '../../core/series/columns';
import { columnsOf } from '../../core/series/columns';
import type { TAggregateTime, TRun } from '../../core/series/point-run';
import { runOf } from '../../core/series/point-run';
import type { ICandle, IPoint, TShape } from '../../core/series/shape';

function elementColumns(shape: TShape, element: IPoint | ICandle): TColumns | undefined {
  if (shape === 'candle') {
    return 'open' in element ? columnsOf({ shape, candles: [element] }) : undefined;
  }
  return 'value' in element ? columnsOf({ shape, points: [element] }) : undefined;
}

export interface IPendingElementOptions {
  readonly shape: TShape;
  /** Length of the element's interval, nanoseconds. */
  readonly step: number;
  readonly aggregateTime: TAggregateTime;
  /** The id of the run the element is shown as; the same for as long as the channel lives. */
  readonly runId: number;
}

/**
 * The element still being formed — the candle of an interval that has not
 * closed. It lies apart from what is known for good: a run of one element
 * whose revision grows with every update, never cached and never kept (§4.4).
 */
export class PendingElement {
  private revision = 0;
  private shown: TRun<bigint> | undefined;

  constructor(private readonly options: IPendingElementOptions) {}

  get run(): TRun<bigint> | undefined {
    return this.shown;
  }

  /** Replaces the element, or takes it away; says whether anything changed. An element of the wrong shape counts as none. */
  set(element: IPoint | ICandle | undefined): boolean {
    const { shape, step, aggregateTime, runId } = this.options;
    const columns = isNil(element) ? undefined : elementColumns(shape, element);
    if (isNil(columns) && isNil(this.shown)) {
      return false;
    }
    this.revision += 1;
    this.shown = isNil(columns)
      ? undefined
      : runOf<bigint>(columns, { id: runId, revision: this.revision, step, aggregateTime });
    return true;
  }
}
