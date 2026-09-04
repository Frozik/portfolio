import { useFunction } from '@frozik/components/hooks/useFunction';
import { millisecondsToISO8601 } from '@frozik/utils/date/iso8601';
import { isNil } from 'lodash-es';
import { Wifi, WifiOff } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

import type { IAttachFailure } from '../application/BinanceViewStore';
import { useBinanceViewStore } from '../application/useBinanceViewStore';
import type { ConnectionState, PersistenceState } from '../domain/types';

import {
  isConnectionOffline,
  pickWorstStatus,
  statusBadgeClass,
  statusIconClass,
  statusLabel,
} from './status-format';
import { binanceT } from './translations';

const STATUS_ICON_SIZE = 15;

/**
 * Badge in the top-nav centre slot. Its colour is the worst of the
 * orderbook and trades channels (plus WebGPU availability); clicking opens
 * per-channel diagnostics.
 */
export const BinanceStatusBadge = observer(() => {
  const store = useBinanceViewStore();
  const tradesStore = store.tradesStore;
  const orderbookStore = store.orderbookStore;

  const orderbookConnection = orderbookStore?.connection ?? 'idle';
  const tradesConnection = tradesStore?.tradesConnection ?? 'idle';
  const hasFirstSnapshot = orderbookStore?.hasFirstOrderbookSnapshot ?? false;
  const attachFailure = store.attachFailure;

  const worst = pickWorstStatus({
    connections: [orderbookConnection, tradesConnection],
    hasFirstSnapshot,
    failure: attachFailure?.kind,
  });

  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const togglePopup = useFunction(() => {
    setIsOpen(previous => !previous);
  });
  const closePopup = useFunction(() => {
    setIsOpen(false);
  });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
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

  const lastSnapshotTimeMs = orderbookStore?.lastDisplaySnapshotTimeMs;
  const lastTradeTimeMs = tradesStore?.lastTradeTimeMs;

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
          orderbookConnection={orderbookConnection}
          tradesConnection={tradesConnection}
          hasFirstSnapshot={hasFirstSnapshot}
          snapshotsReceived={orderbookStore?.snapshotsReceived ?? 0}
          lastSnapshotIso={
            isNil(lastSnapshotTimeMs) ? undefined : millisecondsToISO8601(lastSnapshotTimeMs)
          }
          tradesReceived={tradesStore?.tradesReceivedCount}
          lastTradeIso={isNil(lastTradeTimeMs) ? undefined : millisecondsToISO8601(lastTradeTimeMs)}
          orderbookErrorMessage={orderbookStore?.errorMessage}
          tradesErrorMessage={tradesStore?.tradesErrorMessage}
          failure={attachFailure}
          persistence={store.persistence}
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

function ErrorLine({
  message,
}: {
  readonly message: string | undefined;
}): React.ReactElement | null {
  if (isNil(message)) {
    return null;
  }
  return (
    <p className="text-error">
      {binanceT.live.errorPrefix}
      {message}
    </p>
  );
}

function PersistenceLine({
  persistence,
}: {
  readonly persistence: PersistenceState;
}): React.ReactElement {
  if (persistence.status === 'persisting') {
    return <p>{binanceT.live.persistenceOn}</p>;
  }
  return (
    <p className="text-warning">
      {binanceT.live.persistenceOff}
      {persistence.reason.meta.message}
    </p>
  );
}

function BinanceStatusPopup({
  ref,
  orderbookConnection,
  tradesConnection,
  hasFirstSnapshot,
  snapshotsReceived,
  lastSnapshotIso,
  tradesReceived,
  lastTradeIso,
  orderbookErrorMessage,
  tradesErrorMessage,
  failure,
  persistence,
  onDismiss,
}: {
  readonly ref: React.RefObject<HTMLDivElement | null>;
  readonly orderbookConnection: ConnectionState;
  readonly tradesConnection: ConnectionState;
  readonly hasFirstSnapshot: boolean;
  readonly snapshotsReceived: number;
  readonly lastSnapshotIso: string | undefined;
  readonly tradesReceived: number | undefined;
  readonly lastTradeIso: string | undefined;
  readonly orderbookErrorMessage: string | undefined;
  readonly tradesErrorMessage: string | undefined;
  readonly failure: IAttachFailure | undefined;
  readonly persistence: PersistenceState;
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

      {isNil(failure) ? null : (
        <section className="flex flex-col gap-1 pr-6">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text">
            {failure.kind === 'webgpu'
              ? binanceT.status.unsupported
              : binanceT.live.instrumentUnavailable}
          </h4>
          <ErrorLine message={failure.reason.meta.message} />
        </section>
      )}

      <section className="flex flex-col gap-1 pr-6">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text">
          {binanceT.live.orderbookSection}
        </h4>
        <p>{hasFirstSnapshot ? binanceT.live.snapshotReceived : binanceT.live.awaitingSnapshot}</p>
        <WebsocketStatusLine connection={orderbookConnection} />
        <p className="font-mono">{binanceT.live.totalSnapshots(snapshotsReceived)}</p>
        {isNil(lastSnapshotIso) ? null : (
          <p className="font-mono">{binanceT.live.lastSnapshotTime(lastSnapshotIso)}</p>
        )}
        <ErrorLine message={orderbookErrorMessage} />
      </section>

      {isNil(tradesReceived) ? null : (
        <section className="mt-3 flex flex-col gap-1 border-t border-border pr-6 pt-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text">
            {binanceT.live.tradesSection}
          </h4>
          <WebsocketStatusLine connection={tradesConnection} />
          <p className="font-mono">{binanceT.live.totalTrades(tradesReceived)}</p>
          {isNil(lastTradeIso) ? null : (
            <p className="font-mono">{binanceT.live.lastTradeTime(lastTradeIso)}</p>
          )}
          <ErrorLine message={tradesErrorMessage} />
        </section>
      )}

      <section className="mt-3 flex flex-col gap-1 border-t border-border pr-6 pt-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text">
          {binanceT.live.historySection}
        </h4>
        <PersistenceLine persistence={persistence} />
      </section>
    </div>
  );
}
