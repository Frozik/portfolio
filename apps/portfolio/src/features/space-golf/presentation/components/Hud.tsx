import { Diamond, Flag, RotateCcw } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { SpaceGolfStore } from '../../application/SpaceGolfStore';
import { spaceGolfT } from '../translations';

const ICON_SIZE_PX = 16;

/** The counters of the reference: the level, the strokes over all levels plus this one, the par, the pickups. */
export const Hud = observer(({ store }: { readonly store: SpaceGolfStore }) => (
  <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 font-mono text-sm text-neutral-200">
    <span className="flex items-center gap-1.5 rounded bg-black/50 px-2 py-1">
      <Flag size={ICON_SIZE_PX} aria-hidden="true" />
      {spaceGolfT.hud.level(store.levelNumber)}
    </span>
    <span className="flex items-center gap-2 rounded bg-black/50 px-2 py-1 tabular-nums">
      {spaceGolfT.hud.strokes(store.totalStrokes, store.strokeCount)}
      <span className="text-neutral-500">{spaceGolfT.hud.par(store.par)}</span>
      {store.pickupCount > 0 && (
        <span className="flex items-center gap-1 text-amber-200">
          <Diamond size={ICON_SIZE_PX} aria-hidden="true" />
          {spaceGolfT.hud.pickups(store.collectedCount, store.pickupCount)}
        </span>
      )}
    </span>
    <button
      type="button"
      onClick={store.restart}
      aria-label={spaceGolfT.hud.restart}
      title={spaceGolfT.hud.restart}
      className="pointer-events-auto flex size-9 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300 shadow-lg transition-all hover:scale-110 hover:text-white active:scale-95"
    >
      <RotateCcw size={ICON_SIZE_PX} />
    </button>
  </div>
));
