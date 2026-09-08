import { observer } from 'mobx-react-lite';

import type { SpaceGolfStore } from '../../application/SpaceGolfStore';
import { spaceGolfT } from '../translations';

/** Shown once the ball is in the cup: the score against par and the way on. */
export const LevelCompleteOverlay = observer(({ store }: { readonly store: SpaceGolfStore }) => {
  if (store.status !== 'completed') {
    return null;
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-700 bg-neutral-900/95 px-8 py-6 text-center shadow-2xl">
        <h2 className="text-xl font-medium text-white">{spaceGolfT.complete.title}</h2>
        <p className="font-mono text-sm text-neutral-300">
          {spaceGolfT.complete.strokes(store.strokeCount, store.par)}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={store.restart}
            className="rounded-lg bg-neutral-800 px-4 py-2 text-sm text-neutral-300 transition-colors hover:text-white"
          >
            {spaceGolfT.complete.again}
          </button>
          <button
            type="button"
            onClick={store.nextLevel}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-400"
          >
            {spaceGolfT.complete.next}
          </button>
        </div>
      </div>
    </div>
  );
});
