import { useFunction } from '@frozik/components/hooks/useFunction';
import { millisecondsToISO8601 } from '@frozik/utils/date/iso8601';
import { Wifi, WifiOff } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

import { useBinanceViewStore } from '../application/useBinanceViewStore';
import type { ConnectionState } from '../domain/types';

import {
  isConnectionOffline,
  statusBadgeClass,
  statusIconClass,
  statusLabel,
} from './status-format';
import { binanceT } from './translations';

const STATUS_ICON_SIZE = 15;

/**
 * Worst-of severity rank — higher = worse. Used to fold the orderbook
 * REST + websocket and the trades websocket states into a single
 * indicator color so the badge reads as the chart's overall health.
 */
const CONNECTION_RANK: Record<ConnectionState, number> = {
  connected: 0,
  connecting: 1,
  idle: 2,
  disconnected: 3,
  error: 4,
  unsupported: 4,
};

function pickWorstConnection(states: readonly ConnectionState[]): ConnectionState {
  let worst = states[0];
  for (const candidate of states) {
    if (CONNECTION_RANK[candidate] > CONNECTION_RANK[worst]) {
      worst = candidate;
    }
  }
  return worst;
}

/**
 * Badge mounted inside the {@link TopNav} center slot. Shows the
 * trading instrument's ticker; the badge color reflects the worst-of
 * status across the orderbook REST snapshot, the orderbook websocket,
 * and the trades websocket. Click opens a popup pinned below the
 * badge with per-channel diagnostics (REST status, WS status, total
 * counts, last-event time).
 */
export const BinanceStatusBadge = observer(() => {
  const store = useBinanceViewStore();
  const tradesStore = store.tradesStore;
  const orderbookStore = store.orderbookStore;

  const orderbookConn = store.connection;
  const tradesConn = tradesStore?.tradesConnection ?? 'idle';
  const hasFirstSnapshot = orderbookStore?.hasFirstOrderbookSnapshot ?? false;

  // Even a "connected" WS doesn't mean the page is fully alive while
  // we're still waiting on the first REST snapshot — the chart needs
  // both. Bump the displayed worst-status to at-least `connecting`
  // until the snapshot lands so the badge color matches the user's
  // mental model of "is the data flowing yet?".
  let worst = pickWorstConnection([orderbookConn, tradesConn]);
  if (!hasFirstSnapshot && CONNECTION_RANK[worst] < CONNECTION_RANK.connecting) {
    worst = 'connecting';
  }

  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const togglePopup = useFunction(() => {
    setIsOpen(previous => !previous);
  });
  const closePopup = useFunction(() => {
    setIsOpen(false);
  });

  // Close on outside click and on Escape — same dismissal contract as
  // the orderbook cell tooltip / trades popup elsewhere in the feature.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null;
      if (target === null) {
        return;
      }
      if (buttonRef.current?.contains(target) === true) {
        return;
      }
      if (popupRef.current?.contains(target) === true) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const lastSnapshotIso =
    store.lastDisplaySnapshotTimeMs === undefined
      ? undefined
      : millisecondsToISO8601(store.lastDisplaySnapshotTimeMs);
  const lastTradeIso =
    tradesStore?.lastTradeTimeMs === undefined
      ? undefined
      : millisecondsToISO8601(tradesStore.lastTradeTimeMs);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={togglePopup}
        aria-label={isOpen ? binanceT.live.closeStatusDetails : binanceT.live.openStatusDetails}
        aria-expanded={isOpen}
        title={statusLabel(worst)}
        className={`flex items-center rounded-full p-1 ${statusIconClass(worst)} hover:bg-surface-elevated`}
      >
        {isConnectionOffline(worst) ? (
          <WifiOff size={STATUS_ICON_SIZE} />
        ) : (
          <Wifi size={STATUS_ICON_SIZE} />
        )}
      </button>
      {isOpen ? (
        <BinanceStatusPopup
          ref={popupRef}
          orderbookConn={orderbookConn}
          tradesConn={tradesConn}
          hasFirstSnapshot={hasFirstSnapshot}
          snapshotsReceived={store.snapshotsReceived}
          lastSnapshotIso={lastSnapshotIso}
          tradesReceived={tradesStore?.tradesReceivedCount}
          lastTradeIso={lastTradeIso}
          orderbookErrorMessage={store.errorMessage}
          tradesErrorMessage={tradesStore?.tradesErrorMessage}
          onDismiss={closePopup}
        />
      ) : null}
    </div>
  );
});

function WebsocketStatusLine({
  connection,
}: {
  readonly connection: ConnectionState;
}): React.ReactElement {
  return (
    <p className="flex items-center gap-1.5">
      <span>{binanceT.live.websocketLabel}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(connection)}`}
      >
        {statusLabel(connection)}
      </span>
    </p>
  );
}

function BinanceStatusPopup({
  ref,
  orderbookConn,
  tradesConn,
  hasFirstSnapshot,
  snapshotsReceived,
  lastSnapshotIso,
  tradesReceived,
  lastTradeIso,
  orderbookErrorMessage,
  tradesErrorMessage,
  onDismiss,
}: {
  readonly ref: React.RefObject<HTMLDivElement | null>;
  readonly orderbookConn: ConnectionState;
  readonly tradesConn: ConnectionState;
  readonly hasFirstSnapshot: boolean;
  readonly snapshotsReceived: number;
  readonly lastSnapshotIso: string | undefined;
  readonly tradesReceived: number | undefined;
  readonly lastTradeIso: string | undefined;
  readonly orderbookErrorMessage: string | undefined;
  readonly tradesErrorMessage: string | undefined;
  readonly onDismiss: () => void;
}): React.ReactElement {
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={binanceT.live.openStatusDetails}
      className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-md border border-border bg-surface-elevated/95 px-3 py-2 text-xs text-text-secondary shadow-lg backdrop-blur"
    >
      <button
        type="button"
        aria-label={binanceT.live.closeStatusDetails}
        className="absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-text-muted hover:bg-surface hover:text-text"
        onClick={onDismiss}
      >
        ×
      </button>

      <section className="flex flex-col gap-1 pr-6">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text">
          {binanceT.live.orderbookSection}
        </h4>
        <p>{hasFirstSnapshot ? binanceT.live.snapshotReceived : binanceT.live.awaitingSnapshot}</p>
        <WebsocketStatusLine connection={orderbookConn} />
        <p className="font-mono">{binanceT.live.totalSnapshots(snapshotsReceived)}</p>
        {lastSnapshotIso !== undefined ? (
          <p className="font-mono">{binanceT.live.lastSnapshotTime(lastSnapshotIso)}</p>
        ) : null}
        {orderbookErrorMessage !== undefined ? (
          <p className="text-error">
            {binanceT.live.errorPrefix}
            {orderbookErrorMessage}
          </p>
        ) : null}
      </section>

      {tradesReceived !== undefined ? (
        <section className="mt-3 flex flex-col gap-1 border-t border-border pr-6 pt-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text">
            {binanceT.live.tradesSection}
          </h4>
          <WebsocketStatusLine connection={tradesConn} />
          <p className="font-mono">{binanceT.live.totalTrades(tradesReceived)}</p>
          {lastTradeIso !== undefined ? (
            <p className="font-mono">{binanceT.live.lastTradeTime(lastTradeIso)}</p>
          ) : null}
          {tradesErrorMessage !== undefined ? (
            <p className="text-error">
              {binanceT.live.errorPrefix}
              {tradesErrorMessage}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
