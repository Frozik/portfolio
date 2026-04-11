import { useFunction } from '@frozik/components';
import { memo, useEffect, useState } from 'react';

import type { ISharedTimeseriesRenderer } from '../domain/types';

const FPS_POLL_INTERVAL_MS = 250;

export const DebugOverlay = memo(
  ({
    renderer,
    onDebugChange,
  }: {
    renderer: ISharedTimeseriesRenderer | null;
    onDebugChange: (enabled: boolean) => void;
  }) => {
    const [fps, setFps] = useState(0);
    const [debugEnabled, setDebugEnabled] = useState(false);

    useEffect(() => {
      if (renderer === null) {
        return;
      }

      const intervalId = setInterval(() => {
        setFps(renderer.renderFps);
      }, FPS_POLL_INTERVAL_MS);

      return () => clearInterval(intervalId);
    }, [renderer]);

    const handleToggle = useFunction(() => {
      const next = !debugEnabled;
      setDebugEnabled(next);
      onDebugChange(next);
    });

    return (
      <div className="pointer-events-auto absolute top-1 right-1 z-10 flex items-center gap-2 rounded bg-black/60 px-2 py-1 font-mono text-xs text-white">
        <span className="tabular-nums">{fps} fps</span>
        <label className="flex cursor-pointer items-center gap-1">
          <input
            type="checkbox"
            checked={debugEnabled}
            onChange={handleToggle}
            className="h-3 w-3"
          />
          debug
        </label>
      </div>
    );
  }
);
