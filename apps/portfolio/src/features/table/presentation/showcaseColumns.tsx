import { formatDate } from '@frozik/table/core/format/formatDate';
import { formatNumber } from '@frozik/table/core/format/formatNumber';
import { dateFilter } from '@frozik/table/extensions/filtering/specs/date';
import { enumFilter } from '@frozik/table/extensions/filtering/specs/enum';
import { setFilter } from '@frozik/table/extensions/filtering/specs/set';
import type { ICellContext, IColumn } from '@frozik/table/react/column';
import { reactColumn } from '@frozik/table/react/column';

import { cn } from '@frozik/components/components/cn';

import { Tag } from '../../../shared/ui/Tag';
import { fillsOf } from '../domain/demo-fill';
import type { IDemoTrade, TTradeStatus } from '../domain/demo-trade';
import { notionalOf } from '../domain/demo-trade';
import { NUMBER_LOCALE } from './numberLocale';
import { tableDemoT } from './translations';

const define = reactColumn<IDemoTrade>();

const PRICE_DIGITS = 2;
const QUANTITY_DIGITS = 3;
const ID_WIDTH = 64;
const TIME_WIDTH = 190;
const SIDE_WIDTH = 96;
const STATUS_WIDTH = 120;
const NOTE_WIDTH = 320;

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
      cell: SideCell,
      width: SIDE_WIDTH,
      editor: {
        kind: 'select',
        options: {
          values: [
            { value: 'buy', label: tableDemoT.sides.buy },
            { value: 'sell', label: tableDemoT.sides.sell },
          ],
        },
      },
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
      validate: price => (price <= 0 ? tableDemoT.validation.positive : undefined),
      format: price => formatNumber(price, { locale: NUMBER_LOCALE, digits: PRICE_DIGITS }),
      filter: true,
      aggregate: 'avg',
      editor: { kind: 'number', options: { decimal: PRICE_DIGITS, min: 0 } },
    }),
    define({
      id: 'quantity',
      title: tableDemoT.columns.quantity,
      kind: 'number',
      value: trade => trade.quantity,
      set: (trade, quantity) => ({ ...trade, quantity }),
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
      editor: { kind: 'number', options: { decimal: QUANTITY_DIGITS, min: 0 } },
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
      filter: setFilter({ values: 'accumulate' }),
    }),
    define({
      id: 'status',
      title: tableDemoT.columns.status,
      kind: 'text',
      value: trade => trade.status,
      set: (trade, status) => ({ ...trade, status }),
      cell: StatusCell,
      width: STATUS_WIDTH,
      tooltip: context =>
        context.row.status === 'cancelled'
          ? tableDemoT.tooltips.cancelled
          : { component: FillsTooltip },
      editor: {
        kind: 'select',
        options: {
          values: STATUSES.map(status => ({ value: status, label: tableDemoT.statuses[status] })),
        },
      },
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
      width: NOTE_WIDTH,
      filter: true,
      editor: context => (context.value.length > SHORT_NOTE ? 'textarea' : 'text'),
    }),
  ];
}
