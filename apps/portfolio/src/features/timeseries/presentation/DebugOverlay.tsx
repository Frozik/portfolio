import { useFunction } from '@frozik/components';
import { memo, useEffect, useState } from 'react';

import type { ISharedTimeseriesRenderer } from '../domain/types';

const FPS_POLL_INTERVAL_MS = 250;
const IS_HOSTED = window.location.hostname.endsWith('github.io');

const TOGGLE_TRACK =
  'relative h-4 w-7 shrink-0 cursor-pointer appearance-none rounded-full ' +
  'bg-white/20 transition-colors duration-200 checked:bg-brand-500';

const TOGGLE_THUMB =
  'pointer-events-none absolute top-0.5 left-0.5 h-3 w-3 rounded-full ' +
  'bg-white shadow transition-transform duration-200 peer-checked:translate-x-3';

export const DebugOverlay = memo(({ renderer }: { renderer: ISharedTimeseriesRenderer | null }) => {
  const [fps, setFps] = useState(0);
  const [debugMode, setDebugMode] = useState(false);
  const [instantLoad, setInstantLoad] = useState(true);

  useEffect(() => {
    if (renderer === null) {
      return;
    }

    // Single poll reads all renderer state — fps, debugMode, instantLoad
    const intervalId = setInterval(() => {
      setFps(renderer.renderFps);
      setDebugMode(renderer.debugMode);
      setInstantLoad(renderer.instantLoad);
    }, FPS_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [renderer]);

  const handleDebugToggle = useFunction(() => {
    if (renderer !== null) {
      renderer.debugMode = !renderer.debugMode;
    }
  });

  const handleLoadingDelayToggle = useFunction(() => {
    if (renderer !== null) {
      renderer.instantLoad = !renderer.instantLoad;
    }
  });

  return (
    <div className="pointer-events-auto absolute top-1 right-1 z-10 flex select-none flex-col items-center gap-2 rounded bg-[#1a1a40]/80 px-3 py-2 font-mono text-xs text-white">
      <span className="tabular-nums">{fps} fps</span>
      <div className="flex w-full flex-col gap-1.5">
        {!IS_HOSTED && (
          <label className="flex cursor-pointer items-center justify-between gap-2">
            <span>Debug</span>
            <span className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={debugMode}
                onChange={handleDebugToggle}
                className={`peer ${TOGGLE_TRACK}`}
              />
              <span className={TOGGLE_THUMB} />
            </span>
          </label>
        )}
        <label className="flex cursor-pointer items-center justify-between gap-2">
          <span>Loading delay</span>
          <span className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={!instantLoad}
              onChange={handleLoadingDelayToggle}
              className={`peer ${TOGGLE_TRACK}`}
            />
            <span className={TOGGLE_THUMB} />
          </span>
        </label>
      </div>
    </div>
  );
});
