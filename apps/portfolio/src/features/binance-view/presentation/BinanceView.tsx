import { useFunction } from '@frozik/components';
import { millisecondsToISO8601 } from '@frozik/utils';
import { observer } from 'mobx-react-lite';
import { memo, useEffect, useRef, useState } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { useBinanceViewStore } from '../application/useBinanceViewStore';
import { BINANCE_CONFIG } from '../domain/config';
import type { ConnectionState } from '../domain/types';

import { CellTooltip } from './CellTooltip';
import { binanceT } from './translations';

function statusLabel(connection: ConnectionState): string {
  switch (connection) {
    case 'idle':
      return binanceT.status.idle;
    case 'connecting':
      return binanceT.status.connecting;
    case 'connected':
      return binanceT.status.connected;
    case 'reconnecting':
      return binanceT.status.reconnecting;
    case 'disconnected':
      return binanceT.status.disconnected;
    case 'error':
      return binanceT.status.error;
    case 'unsupported':
      return binanceT.status.unsupported;
  }
}

function statusBadgeClass(connection: ConnectionState): string {
  switch (connection) {
    case 'connected':
      return 'bg-success/20 text-success';
    case 'connecting':
    case 'reconnecting':
      return 'bg-info/20 text-info animate-pulse';
    case 'disconnected':
      return 'bg-warning/20 text-warning';
    case 'error':
    case 'unsupported':
      return 'bg-error/20 text-error';
    case 'idle':
      return 'bg-surface-elevated text-text-muted';
  }
}

const StatusOverlay = observer(() => {
  const store = useBinanceViewStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = useFunction(() => {
    setIsExpanded(previous => !previous);
  });

  const isAwaitingFirstSnapshot =
    store.connection === 'connecting' && store.snapshotsReceived === 0;
  const lastSnapshotIso =
    store.lastDisplaySnapshotTimeMs === undefined
      ? undefined
      : millisecondsToISO8601(store.lastDisplaySnapshotTimeMs);

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-10 flex max-w-sm flex-col gap-2 rounded-lg border border-border bg-surface-elevated/85 px-3 py-2 text-xs text-text-secondary backdrop-blur">
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex cursor-pointer items-center gap-2"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? binanceT.live.collapse : binanceT.live.expand}
      >
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(store.connection)}`}
        >
          {statusLabel(store.connection)}
        </span>
        <span className="text-text-muted">
          {binanceT.live.instrument(BINANCE_CONFIG.instrument)}
        </span>
      </button>

      {isExpanded ? (
        <>
          <p>
            {isAwaitingFirstSnapshot
              ? binanceT.live.awaitingSnapshot
              : binanceT.live.snapshotReceived}
          </p>

          <ul className="flex flex-col gap-0.5 font-mono">
            <li>{binanceT.live.totalSnapshots(store.snapshotsReceived)}</li>
            {lastSnapshotIso !== undefined ? (
              <li>{binanceT.live.lastSnapshotTime(lastSnapshotIso)}</li>
            ) : null}
          </ul>

          {store.errorMessage !== undefined ? (
            <p className="text-error">
              {binanceT.live.errorPrefix}
              {store.errorMessage}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
});

const BinanceViewContent = observer(() => {
  const store = useBinanceViewStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingPointerRef = useRef<{ x: number; y: number } | null>(null);
  const hoverActiveRef = useRef(false);
  const hoverRafIdRef = useRef<number | undefined>(undefined);

  // While the pointer is hovering (not dragging), re-resolve the cell
  // under the cursor on every animation frame. This catches viewport
  // motion (follow-mode auto-pan, RAF-driven zoom / pan inertia) that
  // changes what's underneath a stationary mouse — without this the
  // tooltip would freeze on the last snapshot the cursor moved over.
  const hoverLoop = useFunction(() => {
    hoverRafIdRef.current = undefined;
    if (!hoverActiveRef.current) {
      return;
    }
    const point = pendingPointerRef.current;
    if (point !== null) {
      void store.resolveCellAt(point);
    }
    hoverRafIdRef.current = requestAnimationFrame(hoverLoop);
  });

  const startHoverLoop = useFunction(() => {
    if (hoverActiveRef.current) {
      return;
    }
    hoverActiveRef.current = true;
    if (hoverRafIdRef.current === undefined) {
      hoverRafIdRef.current = requestAnimationFrame(hoverLoop);
    }
  });

  const stopHoverLoop = useFunction(() => {
    hoverActiveRef.current = false;
    if (hoverRafIdRef.current !== undefined) {
      cancelAnimationFrame(hoverRafIdRef.current);
      hoverRafIdRef.current = undefined;
    }
    pendingPointerRef.current = null;
  });

  const handleCanvasPointerMove = useFunction((event: React.PointerEvent<HTMLCanvasElement>) => {
    // Suppress hover resolution while any pointer button is held — the
    // viewport controller treats that as a pan, and a lingering tooltip
    // on top of a dragged chart is distracting.
    if (event.buttons !== 0) {
      return;
    }
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    pendingPointerRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    startHoverLoop();
  });

  const handleCanvasPointerDown = useFunction(() => {
    stopHoverLoop();
    store.clearSelectedCell();
  });

  const handleCanvasPointerLeave = useFunction(() => {
    stopHoverLoop();
    store.clearSelectedCell();
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    let active = true;

    void store.attachCanvas(canvas).then(() => {
      if (!active) {
        return;
      }
      store.startStream();
    });

    return () => {
      active = false;
      stopHoverLoop();
      store.dispose();
    };
  }, [store, stopHoverLoop]);

  return (
    <div className="relative h-full w-full bg-[#1a1a1a]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full [touch-action:none]"
        onPointerMove={handleCanvasPointerMove}
        onPointerDown={handleCanvasPointerDown}
        onPointerLeave={handleCanvasPointerLeave}
      />
      <StatusOverlay />
      <CellTooltip />
    </div>
  );
});

export const BinanceView = memo(() => {
  return (
    <WebGpuGuard className="h-full w-full">
      <BinanceViewContent />
    </WebGpuGuard>
  );
});
