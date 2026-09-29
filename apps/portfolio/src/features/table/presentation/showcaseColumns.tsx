import { formatDate } from '@frozik/table/core/format/formatDate';
import { formatNumber } from '@frozik/table/core/format/formatNumber';
import { dateFilter } from '@frozik/table/extensions/filtering/specs/date';
import { enumFilter } from '@frozik/table/extensions/filtering/specs/enum';
import { setFilter } from '@frozik/table/extensions/filtering/specs/set';
import { numberCell } from '@frozik/table/react/cells/numberCell';
import { selectCell } from '@frozik/table/react/cells/selectCell';
import { textareaCell } from '@frozik/table/react/cells/textareaCell';
import { TextCell } from '@frozik/table/react/cells/TextCell';
import type { ICellContext, IColumn } from '@frozik/table/react/column';
import { reactColumn } from '@frozik/table/react/column';

import { cn } from '@frozik/components/components/cn';

import { Tag } from '../../../shared/ui/Tag';
import { fillsOf } from '../domain/demo-fill';
import type { IDemoTrade, TTradeSide, TTradeStatus } from '../domain/demo-trade';
import { notionalOf } from '../domain/demo-trade';
import { RowActionsCell } from './components/RowActionsCell';
import { NUMBER_LOCALE } from './numberLocale';
import { tableDemoT } from './translations';

const define = reactColumn<IDemoTrade>();

const PRICE_DIGITS = 2;
const QUANTITY_DIGITS = 0;
const ID_WIDTH = 64;
const TIME_WIDTH = 190;
const SIDE_WIDTH = 96;
const STATUS_WIDTH = 120;
const NOTE_WIDTH = 320;
const ACTIONS_WIDTH = 88;

const STATUS_COLOR: Readonly<Record<TTradeStatus, 'green' | 'orange' | 'red'>> = {
  filled: 'green',
  partial: 'orange',
  cancelled: 'red',
};

const SideCell = ({ row }: ICellContext<IDemoTrade>) => (
  <span className={cn('font-medium', row.side === 'buy' ? 'text-success' : 'text-error')}>
    {tableDemoT.sides[row.side]}
  </span>
);

const LARGE_QUANTITY = 10;
const SHORT_NOTE = 24;
const STATUSES: readonly TTradeStatus[] = ['filled', 'partial', 'cancelled'];

const FillsTooltip = ({ row }: ICellContext<IDemoTrade>) => (
  <span>
    {tableDemoT.detail.fills}: {fillsOf(row).length}
  </span>
);

const StatusCell = ({ row }: ICellContext<IDemoTrade>) => (
  <Tag color={STATUS_COLOR[row.status]}>{tableDemoT.statuses[row.status]}</Tag>
);

const SIDES: readonly TTradeSide[] = ['buy', 'sell'];

const LongNoteCell = textareaCell<IDemoTrade>();

export function showcaseColumns(locale: string): readonly IColumn<IDemoTrade, unknown>[] {
  return [
    define({
      id: 'id',
      title: tableDemoT.columns.id,
      kind: 'number',
      value: trade => trade.id,
      width: ID_WIDTH,
      pin: 'left',
      lock: { hide: true },
      aggregate: 'count',
      groupable: false,
    }),
    define({
      id: 'time',
      title: tableDemoT.columns.time,
      kind: 'datetime',
      value: trade => trade.time,
      format: time => formatDate(time, { locale, timeZone: 'UTC', style: 'datetimeSeconds' }),
      width: TIME_WIDTH,
      filter: dateFilter({ timeZone: 'UTC' }),
    }),
    define({
      id: 'symbol',
      title: tableDemoT.columns.symbol,
      kind: 'text',
      value: trade => trade.symbol,
      filter: setFilter({ values: 'accumulate' }),
    }),
    define({
      id: 'side',
      title: tableDemoT.columns.side,
      kind: 'text',
      value: trade => trade.side,
      set: (trade, side) => ({ ...trade, side }),
      editable: true,
      cell: selectCell({
        values: SIDES.map(side => ({ value: side, label: tableDemoT.sides[side] })),
        view: SideCell,
      }),
      width: SIDE_WIDTH,
      filter: enumFilter({
        options: [
          { key: 'buy', label: tableDemoT.sides.buy },
          { key: 'sell', label: tableDemoT.sides.sell },
        ],
      }),
    }),
    define({
      id: 'price',
      title: tableDemoT.columns.price,
      kind: 'number',
      value: trade => trade.price,
      set: (trade, price) => ({ ...trade, price }),
      editable: ({ row }) => row.status !== 'filled',
      validate: price => (price <= 0 ? tableDemoT.validation.positive : undefined),
      format: price => formatNumber(price, { locale: NUMBER_LOCALE, digits: PRICE_DIGITS }),
      filter: true,
      aggregate: 'avg',
      cell: numberCell({ decimal: PRICE_DIGITS, min: 0 }),
    }),
    define({
      id: 'quantity',
      title: tableDemoT.columns.quantity,
      kind: 'number',
      value: trade => trade.quantity,
      set: (trade, quantity) => ({ ...trade, quantity }),
      editable: true,
      validate: quantity =>
        quantity <= 0
          ? tableDemoT.validation.positive
          : quantity > LARGE_QUANTITY
            ? { level: 'warning', message: tableDemoT.validation.large }
            : undefined,
      format: quantity =>
        formatNumber(quantity, { locale: NUMBER_LOCALE, digits: QUANTITY_DIGITS }),
      filter: true,
      aggregate: 'sum',
      cell: numberCell({ decimal: QUANTITY_DIGITS, min: 0 }),
    }),
    define({
      id: 'notional',
      title: tableDemoT.columns.notional,
      kind: 'number',
      value: notionalOf,
      format: notional => formatNumber(notional, { locale: NUMBER_LOCALE, digits: PRICE_DIGITS }),
      filter: true,
      filterRow: false,
      aggregate: 'sum',
      headerTooltip: tableDemoT.tooltips.notional,
    }),
    define({
      id: 'venue',
      title: tableDemoT.columns.venue,
      kind: 'text',
      value: trade => trade.venue,
      set: (trade, venue) => ({ ...trade, venue }),
      editable: true,
      filter: setFilter({ values: 'accumulate' }),
    }),
    define({
      id: 'status',
      title: tableDemoT.columns.status,
      kind: 'text',
      value: trade => trade.status,
      set: (trade, status) => ({ ...trade, status }),
      editable: true,
      cell: selectCell({
        values: STATUSES.map(status => ({ value: status, label: tableDemoT.statuses[status] })),
        view: StatusCell,
      }),
      width: STATUS_WIDTH,
      tooltip: context =>
        context.row.status === 'cancelled'
          ? tableDemoT.tooltips.cancelled
          : { component: FillsTooltip },
      filter: setFilter<TTradeStatus>({
        values: ['filled', 'partial', 'cancelled'],
        labelOf: status => tableDemoT.statuses[status],
      }),
    }),
    define({
      id: 'note',
      title: tableDemoT.columns.note,
      kind: 'text',
      value: trade => trade.note,
      set: (trade, note) => ({ ...trade, note }),
      editable: true,
      width: NOTE_WIDTH,
      filter: true,
      cell: context => (context.value.length > SHORT_NOTE ? LongNoteCell : TextCell),
    }),
    define({
      id: 'actions',
      title: tableDemoT.columns.actions,
      kind: 'custom',
      value: trade => trade.id,
      cell: RowActionsCell,
      width: ACTIONS_WIDTH,
      hidden: true,
      interactive: true,
      align: 'center',
      sort: false,
      groupable: false,
      copy: 'text',
    }),
  ];
}
