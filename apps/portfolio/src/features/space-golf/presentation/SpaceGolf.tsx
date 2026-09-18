import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { runSpaceGolf } from '../application/render/run-space-golf';
import { SpaceGolfStore } from '../application/SpaceGolfStore';
import { useSpaceGolfStore } from '../application/useSpaceGolfStore';
import { createIndexedDBWorldRepository } from '../infrastructure/IndexedDBWorldRepository';
import { Compass } from './components/Compass';
import { Hud } from './components/Hud';
import { ScaleBar } from './components/ScaleBar';
import { spaceGolfT } from './translations';

const SEED_RANGE = 2 ** 31;

/** The composition root: the store gets its database and its source of new worlds here and nowhere else. */
function createStore(): SpaceGolfStore {
  return new SpaceGolfStore(createIndexedDBWorldRepository(), () =>
    Math.floor(Math.random() * SEED_RANGE)
  );
}

export const SpaceGolf = observer(() => {
  const store = useSpaceGolfStore(createStore);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (isNil(canvas)) {
      return undefined;
    }
    // A new world's sectors are sized to the screen it is made on.
    void store.start({ width: canvas.clientWidth, height: canvas.clientHeight });
    return runSpaceGolf({ canvas, store });
  }, [store]);

  return (
    <WebGpuGuard className="h-full w-full">
      <div className="relative h-full w-full select-none bg-[#05060c]">
        <canvas ref={canvasRef} className="h-full w-full [touch-action:none]" />
        <Hud store={store} />
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col items-center gap-2">
          <Compass store={store} />
          <ScaleBar store={store} />
        </div>
        {store.status === 'loading' && (
          <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center font-mono text-xs text-neutral-400">
            {spaceGolfT.status.loading}
          </p>
        )}
        {store.status === 'playing' && store.totalStrokes === 0 && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-max max-w-[92%] rounded bg-black/60 px-3 py-1 text-center font-mono text-xs text-neutral-400">
            {spaceGolfT.help.aim}
          </p>
        )}
      </div>
    </WebGpuGuard>
  );
});
