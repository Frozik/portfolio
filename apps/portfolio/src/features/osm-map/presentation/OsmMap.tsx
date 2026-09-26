import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { OsmMapStore } from '../application/OsmMapStore';
import { runOsmMap } from '../application/render/run-osm-map';
import { useOsmMapStore } from '../application/useOsmMapStore';
import { requestCurrentPosition } from '../infrastructure/geolocation';
import { createHomeStorage } from '../infrastructure/home-storage';
import { Attribution } from './components/Attribution';
import { Compass } from './components/Compass';
import { Hud } from './components/Hud';
import { LocateButton } from './components/LocateButton';
import { osmMapT } from './translations';

/** The composition root: the store gets the browser's geolocation and web storage here and nowhere else. */
function createStore(): OsmMapStore {
  return new OsmMapStore(requestCurrentPosition, createHomeStorage());
}

export const OsmMap = observer(() => {
  const store = useOsmMapStore(createStore);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (isNil(canvas)) {
      return undefined;
    }
    return runOsmMap({ canvas, store });
  }, [store]);

  return (
    <WebGpuGuard className="h-full w-full">
      <div className="relative h-full w-full select-none">
        <canvas ref={canvasRef} className="h-full w-full [touch-action:none]" />
        <Hud store={store} />
        <Compass store={store} />
        <LocateButton store={store} />
        <p className="pointer-events-none absolute inset-x-0 bottom-8 mx-auto w-max max-w-[92%] rounded bg-neutral-900/60 px-3 py-1 text-center font-mono text-xs text-neutral-200">
          {osmMapT.help}
        </p>
        <Attribution />
      </div>
    </WebGpuGuard>
  );
});
