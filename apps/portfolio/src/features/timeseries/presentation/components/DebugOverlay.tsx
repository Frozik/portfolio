import { useChartStage } from '@frozik/charts/react/ChartStageProvider';
import { getIsHosted } from '@frozik/utils/isHosted';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { useTimeseriesDemoStore } from '../../application/useTimeseriesDemoStore';
import { timeseriesT } from '../translations';

const FPS_POLL_INTERVAL_MS = 250;
const IS_HOSTED = getIsHosted();

const RENDERER_NAMES: Readonly<Record<string, string>> = timeseriesT.debugOverlay.renderers;

const TOGGLE_TRACK =
  'relative h-4 w-7 shrink-0 cursor-pointer appearance-none rounded-full ' +
  'bg-white/20 transition-colors duration-200 checked:bg-brand-500';

const TOGGLE_THUMB =
  'pointer-events-none absolute top-0.5 left-0.5 h-3 w-3 rounded-full ' +
  'bg-white shadow transition-transform duration-200 peer-checked:translate-x-3';

function Toggle({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  const handleChange = useEventCallback(() => onChange(!checked));
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2">
      <span>{label}</span>
      <span className="relative inline-flex items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          className={`peer ${TOGGLE_TRACK}`}
        />
        <span className={TOGGLE_THUMB} />
      </span>
    </label>
  );
}

/** Frames the stage really draws a second, and the switches every page of the demo obeys. */
export const DebugOverlay = observer(() => {
  const store = useTimeseriesDemoStore();
  const stageState = useChartStage();
  const stage = stageState.status === 'ready' ? stageState.stage : undefined;
  const [fps, setFps] = useState(0);
  const [renderers, setRenderers] = useState('');

  useEffect(() => {
    if (isNil(stage)) {
      return undefined;
    }
    // Polled, not read once: the stage drops a backend it lost and goes on with the rest.
    const read = (): void => {
      setFps(stage.fps);
      setRenderers(stage.backendIds.map(id => RENDERER_NAMES[id] ?? id).join(' + '));
    };
    read();
    const intervalId = setInterval(read, FPS_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [stage]);

  return (
    <div className="pointer-events-auto absolute top-1 right-1 z-10 flex select-none flex-col items-center gap-2 rounded bg-[#1a1a40]/80 px-3 py-2 font-mono text-xs text-white">
      <span className="tabular-nums">{fps} fps</span>
      <span className="text-white/70">{renderers}</span>
      <div className="flex w-full flex-col gap-1.5">
        {!IS_HOSTED && (
          <Toggle
            label={timeseriesT.debugOverlay.debug}
            checked={store.debug}
            onChange={store.setDebug}
          />
        )}
        <Toggle
          label={timeseriesT.debugOverlay.loadingDelay}
          checked={store.loadingDelay}
          onChange={store.setLoadingDelay}
        />
        <Toggle
          label={timeseriesT.debugOverlay.sourceFailures}
          checked={store.sourceFailures}
          onChange={store.setSourceFailures}
        />
        <Toggle
          label={timeseriesT.debugOverlay.canvasOnly}
          checked={store.canvasOnly}
          onChange={store.setCanvasOnly}
        />
      </div>
    </div>
  );
});
