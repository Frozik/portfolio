import '@frozik/table/theme/table.css';

import { clientRows } from '@frozik/table/core/rows/client-rows';
import { gridView } from '@frozik/table/extensions/grid-view/core';
import type { ICellContext } from '@frozik/table/react/column';
import { reactColumn } from '@frozik/table/react/column';
import { sorting } from '@frozik/table/react/extensions/sorting/sorting';
import { Table } from '@frozik/table/react/Table';
import { useLiveValue } from '@frozik/table/react/useLiveValue';
import { useTable } from '@frozik/table/react/useTable';
import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { cn } from '@frozik/components/components/cn';

import { Spinner } from '../../../../shared/ui/Spinner';
import { COLOR_BUY, COLOR_SELL } from '../../domain/trades-constants';
import type { ITrade } from '../../domain/trades-types';
import { binanceT } from '../translations';

import { buildWeightBarBackground } from './build-weight-bar-background';
import { PRICE_FRACTION_DIGITS, QUANTITY_FRACTION_DIGITS, ROW_HEIGHT_PX } from './constants';
import { formatTradeTime } from './format-trade-time';

const define = reactColumn<ITrade>();

const TimeCell = ({ row }: ICellContext<ITrade>) => (
  <span className="text-text-muted">{formatTradeTime(row.eventTimeMs)}</span>
);

const SideCell = ({ row }: ICellContext<ITrade>) => (
  <span className={row.isBuyerMaker ? 'text-error' : 'text-success'}>
    {row.isBuyerMaker ? binanceT.tradePopup.sell : binanceT.tradePopup.buy}
  </span>
);

/** The price carries a bar sized by the trade's share of the bucket. */
const priceCell =
  (totalNotional: number) =>
  ({ row }: ICellContext<ITrade>) => {
    const weightFraction =
      totalNotional > 0 ? (row.price * (row.quantity as number)) / totalNotional : 0;
    const sideHex = row.isBuyerMaker ? COLOR_SELL : COLOR_BUY;
    return (
      <span
        className="block w-full rounded-sm px-1.5 py-0.5 text-right text-text"
        style={{ background: buildWeightBarBackground(weightFraction, sideHex) }}
      >
        {row.price.toFixed(PRICE_FRACTION_DIGITS)}
      </span>
    );
  };

/** The popup is 400px wide: three fixed columns and the price bar taking what is left. */
const TIME_WIDTH_PX = 112;
const SIDE_WIDTH_PX = 76;
const QUANTITY_WIDTH_PX = 92;

const LARGEST_FIRST = {
  extensions: { sorting: [{ columnId: 'quantity', direction: 'desc' as const }] },
};

export function TradeBucketPopupBody({
  trades,
  totalNotional,
  isLoading,
  maxHeightPx,
}: {
  readonly trades: readonly ITrade[];
  readonly totalNotional: number;
  readonly isLoading: boolean;
  /** A cap for an anchored popup; without it the table fills the flex column it is placed in and scrolls inside. */
  readonly maxHeightPx?: number;
}): ReactElement {
  const columns = useMemo(
    () => [
      define({
        id: 'time',
        title: binanceT.tradePopup.columnTime,
        kind: 'number',
        value: trade => trade.eventTimeMs,
        align: 'start',
        cell: TimeCell,
        width: TIME_WIDTH_PX,
      }),
      define({
        id: 'side',
        title: binanceT.tradePopup.columnSide,
        kind: 'text',
        value: trade => (trade.isBuyerMaker ? binanceT.tradePopup.sell : binanceT.tradePopup.buy),
        cell: SideCell,
        width: SIDE_WIDTH_PX,
      }),
      define({
        id: 'quantity',
        title: binanceT.tradePopup.columnQuantity,
        kind: 'number',
        value: trade => trade.quantity as number,
        format: quantity => quantity.toFixed(QUANTITY_FRACTION_DIGITS),
        width: QUANTITY_WIDTH_PX,
      }),
      define({
        id: 'price',
        title: binanceT.tradePopup.columnPrice,
        kind: 'number',
        value: trade => trade.price,
        cell: priceCell(totalNotional),
        flex: 1,
      }),
    ],
    [totalNotional]
  );
  const liveTrades = useLiveValue(trades);
  const model = useTable({
    columns,
    rowKey: trade => String(trade.tradeId),
    rows: clientRows({ rows: liveTrades }),
    extensions: [gridView({ rowHeight: ROW_HEIGHT_PX }), sorting({ cycle: ['desc', 'asc', null] })],
    initialState: LARGEST_FIRST,
    context: undefined,
  });

  if (isLoading && trades.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-4 text-center text-text-muted">
        <Spinner size="sm" />
        <span>{binanceT.tradePopup.loading}</span>
      </div>
    );
  }
  if (trades.length === 0) {
    return <div className="px-2 py-3 text-center text-text-muted">{binanceT.tradePopup.empty}</div>;
  }
  return (
    <div
      className={cn('flex min-h-0 flex-col', maxHeightPx === undefined && 'flex-1')}
      style={maxHeightPx === undefined ? undefined : { maxHeight: maxHeightPx }}
    >
      <Table
        model={model}
        className="min-h-0 flex-1 font-mono"
        theme="dark"
        density="compact"
        frame={false}
      />
    </div>
  );
}
