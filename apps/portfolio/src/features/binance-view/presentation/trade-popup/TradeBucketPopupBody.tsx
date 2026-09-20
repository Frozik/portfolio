import type { VirtualTableColumn } from '@frozik/components/components/VirtualTable/VirtualTable';
import { VirtualTable } from '@frozik/components/components/VirtualTable/VirtualTable';
import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { Spinner } from '../../../../shared/ui/Spinner';
import { COLOR_BUY, COLOR_SELL } from '../../domain/trades-constants';
import type { ITrade } from '../../domain/trades-types';
import { binanceT } from '../translations';

import { buildWeightBarBackground } from './build-weight-bar-background';
import { PRICE_FRACTION_DIGITS, QUANTITY_FRACTION_DIGITS, ROW_HEIGHT_PX } from './constants';
import { formatTradeTime } from './format-trade-time';

const timeCell = (trade: ITrade) => (
  <span className="text-text-muted">{formatTradeTime(trade.eventTimeMs)}</span>
);

const sideCell = (trade: ITrade) => (
  <span className={trade.isBuyerMaker ? 'text-error' : 'text-success'}>
    {trade.isBuyerMaker ? binanceT.tradePopup.sell : binanceT.tradePopup.buy}
  </span>
);

const quantityCell = (trade: ITrade) =>
  (trade.quantity as number).toFixed(QUANTITY_FRACTION_DIGITS);

/** The price carries a bar sized by the trade's share of the bucket. */
const priceCell = (totalNotional: number) => (trade: ITrade) => {
  const weightFraction =
    totalNotional > 0 ? (trade.price * (trade.quantity as number)) / totalNotional : 0;
  const sideHex = trade.isBuyerMaker ? COLOR_SELL : COLOR_BUY;
  return (
    <span
      className="block rounded-sm px-1.5 py-0.5 text-right text-text"
      style={{ background: buildWeightBarBackground(weightFraction, sideHex) }}
    >
      {trade.price.toFixed(PRICE_FRACTION_DIGITS)}
    </span>
  );
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
  readonly maxHeightPx: number;
}): ReactElement {
  const columns = useMemo<readonly VirtualTableColumn<ITrade>[]>(
    () => [
      {
        id: 'time',
        header: binanceT.tradePopup.columnTime,
        value: trade => trade.eventTimeMs,
        cell: timeCell,
        sortable: true,
      },
      {
        id: 'side',
        header: binanceT.tradePopup.columnSide,
        value: trade => (trade.isBuyerMaker ? binanceT.tradePopup.sell : binanceT.tradePopup.buy),
        cell: sideCell,
        sortable: true,
      },
      {
        id: 'quantity',
        header: binanceT.tradePopup.columnQuantity,
        value: trade => trade.quantity as number,
        cell: quantityCell,
        sortable: true,
        align: 'right',
      },
      {
        id: 'price',
        header: binanceT.tradePopup.columnPrice,
        value: trade => trade.price,
        cell: priceCell(totalNotional),
        sortable: true,
        align: 'right',
      },
    ],
    [totalNotional]
  );

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
    <VirtualTable
      className="font-mono"
      maxHeightPx={maxHeightPx}
      rows={trades}
      columns={columns}
      rowKey={trade => String(trade.tradeId)}
      initialSort={{ columnId: 'quantity', direction: 'desc' }}
      estimatedRowHeightPx={ROW_HEIGHT_PX}
    />
  );
}
