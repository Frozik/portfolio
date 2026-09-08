import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { runSpaceGolf } from '../application/render/run-space-golf';
import { SpaceGolfStore } from '../application/SpaceGolfStore';
import { useSpaceGolfStore } from '../application/useSpaceGolfStore';
import { createIndexedDBProgressRepository } from '../infrastructure/IndexedDBProgressRepository';
import { WorkerLevelSource } from '../infrastructure/WorkerLevelSource';
import { Hud } from './components/Hud';
import { LevelCompleteOverlay } from './components/LevelCompleteOverlay';
import { spaceGolfT } from './translations';

const RESTART_KEY = 'r';

/** The composition root: the store gets its worker and its database here and nowhere else. */
function createStore(): SpaceGolfStore {
  return new SpaceGolfStore(new WorkerLevelSource(), createIndexedDBProgressRepository());
}

export const SpaceGolf = observer(() => {
  const store = useSpaceGolfStore(createStore);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    void store.start();
  }, [store]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (isNil(canvas)) {
      return undefined;
    }
    return runSpaceGolf({ canvas, store });
  }, [store]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() === RESTART_KEY && !event.metaKey && !event.ctrlKey) {
        store.restart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  return (
    <WebGpuGuard className="h-full w-full">
      <div className="relative h-full w-full select-none bg-[#05060c]">
        <canvas ref={canvasRef} className="h-full w-full [touch-action:none]" />
        <Hud store={store} />
        {store.status === 'loading' && (
          <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center font-mono text-xs text-neutral-400">
            {spaceGolfT.status.loading}
          </p>
        )}
        {store.status === 'failed' && (
          <p className="absolute inset-x-0 bottom-6 px-6 text-center font-mono text-xs text-red-300">
            {spaceGolfT.status.failed}
          </p>
        )}
        {store.status === 'playing' && store.levelNumber === 1 && store.strokeCount === 0 && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-max max-w-[92%] rounded bg-black/60 px-3 py-1 text-center font-mono text-xs text-neutral-400">
            {spaceGolfT.help.aim}
          </p>
        )}
        <LevelCompleteOverlay store={store} />
      </div>
    </WebGpuGuard>
  );
});
