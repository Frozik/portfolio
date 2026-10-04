import type { IColumn } from '@frozik/table/react/column';
import { reactColumn } from '@frozik/table/react/column';

import type { IPosition, TSide } from '../domain/desk';
import { profitOf } from '../domain/desk';
import { formatMoney } from './money';
import { bugReporterDemoT } from './translations';

const define = reactColumn<IPosition>();

const INSTRUMENT_WIDTH = 110;
const SIDE_WIDTH = 80;
const NUMBER_WIDTH = 100;
const MASKED_CELL = 'bug-mask';

export function positionColumns(): readonly IColumn<IPosition, unknown>[] {
  return [
    define({
      id: 'instrument',
      title: bugReporterDemoT.columns.instrument,
      kind: 'text',
      value: position => position.instrument,
      width: INSTRUMENT_WIDTH,
    }),
    define({
      id: 'side',
      title: bugReporterDemoT.columns.side,
      kind: 'text',
      value: position => position.side,
      format: (side: TSide) => bugReporterDemoT.sides[side],
      width: SIDE_WIDTH,
    }),
    define({
      id: 'quantity',
      title: bugReporterDemoT.columns.quantity,
      kind: 'number',
      value: position => position.quantity,
      width: NUMBER_WIDTH,
      cellClass: MASKED_CELL,
    }),
    define({
      id: 'averagePrice',
      title: bugReporterDemoT.columns.averagePrice,
      kind: 'number',
      value: position => position.averagePrice,
      format: (price: number) => formatMoney(price),
      width: NUMBER_WIDTH,
    }),
    define({
      id: 'lastPrice',
      title: bugReporterDemoT.columns.lastPrice,
      kind: 'number',
      value: position => position.lastPrice,
      format: (price: number) => formatMoney(price),
      width: NUMBER_WIDTH,
    }),
    define({
      id: 'profit',
      title: bugReporterDemoT.columns.profit,
      kind: 'number',
      value: position => profitOf(position),
      format: (profit: number) => formatMoney(profit),
      width: NUMBER_WIDTH,
      cellClass: MASKED_CELL,
    }),
  ];
}
