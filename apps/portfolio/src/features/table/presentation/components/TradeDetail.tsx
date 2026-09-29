import { formatDate } from '@frozik/table/core/format/formatDate';
import { formatNumber } from '@frozik/table/core/format/formatNumber';
import { clientRows } from '@frozik/table/core/rows/client-rows';
import { gridView } from '@frozik/table/extensions/grid-view/core';
import type { IRowContext } from '@frozik/table/react/column';
import { reactColumn } from '@frozik/table/react/column';
import { Table } from '@frozik/table/react/Table';
import { useTable } from '@frozik/table/react/useTable';
import { observer } from 'mobx-react-lite';
import { useMemo } from 'react';

import { useTableDemoStore } from '../../application/useTableDemoStore';
import type { IDemoFill } from '../../domain/demo-fill';
import { fillsOf } from '../../domain/demo-fill';
import type { IDemoTrade } from '../../domain/demo-trade';
import { NUMBER_LOCALE } from '../numberLocale';
import { tableDemoT } from '../translations';

const define = reactColumn<IDemoFill>();
const PRICE_DIGITS = 2;
const QUANTITY_DIGITS = 0;

function fillColumns(locale: string) {
  return [
    define({
      id: 'time',
      title: tableDemoT.columns.time,
      kind: 'datetime',
      value: fill => fill.time,
      format: time => formatDate(time, { locale, timeZone: 'UTC', style: 'time' }),
    }),
    define({
      id: 'price',
      title: tableDemoT.columns.price,
      kind: 'number',
      value: fill => fill.price,
      format: price => formatNumber(price, { locale: NUMBER_LOCALE, digits: PRICE_DIGITS }),
    }),
    define({
      id: 'quantity',
      title: tableDemoT.columns.quantity,
      kind: 'number',
      value: fill => fill.quantity,
      format: quantity =>
        formatNumber(quantity, { locale: NUMBER_LOCALE, digits: QUANTITY_DIGITS }),
    }),
    define({
      id: 'venue',
      title: tableDemoT.columns.venue,
      kind: 'text',
      value: fill => fill.venue,
    }),
  ];
}

/** A nested table of the trade's fills: its own model, columns and id, fed by the parent row. */
export const TradeDetail = observer(function TradeDetail({ displayRow }: IRowContext<IDemoTrade>) {
  const store = useTableDemoStore();
  const trade = displayRow.kind === 'leaf' ? displayRow.row : undefined;
  const fills = useMemo(() => (trade === undefined ? [] : fillsOf(trade)), [trade]);
  const columns = useMemo(() => fillColumns(store.locale), [store.locale]);
  const model = useTable({
    id: trade === undefined ? undefined : `trade-${trade.id}:fills`,
    columns,
    rowKey: 'id',
    rows: clientRows({ rows: () => fills }),
    extensions: [gridView({ layout: 'content', virtualizeColumns: false })],
    context: undefined,
  });
  return (
    <>
      <span className="text-xs text-landing-fg-dim">
        {tableDemoT.detail.fills}: {fills.length}
      </span>
      <Table
        model={model}
        theme={store.theme}
        density="compact"
        locale={store.locale}
        numberLocale={NUMBER_LOCALE}
      />
    </>
  );
});
