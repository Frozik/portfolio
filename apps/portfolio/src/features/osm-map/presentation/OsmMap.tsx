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
import { HelpPopover } from './components/HelpPopover';
import { LoadingBar } from './components/LoadingBar';
import { LocateButton } from './components/LocateButton';

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
        <LoadingBar store={store} />
        <Compass store={store} />
        <LocateButton store={store} />
        <HelpPopover />
        <Attribution />
      </div>
    </WebGpuGuard>
  );
});
