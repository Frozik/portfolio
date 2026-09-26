import { observer } from 'mobx-react-lite';

import type { OsmMapStore } from '../../application/OsmMapStore';
import { osmMapT } from '../translations';

const VIEW_BOX_SIZE = 40;
const CENTER = VIEW_BOX_SIZE / 2;
const RING_RADIUS = 18;
const NEEDLE_LENGTH = 14;
const NEEDLE_HALF_WIDTH = 4;

/**
 * Where north is on the screen: the needle turns against the bearing, so it
 * keeps pointing at true north while the map rotates under it. Pressing it
 * turns the map back to north-up.
 */
export const Compass = observer(({ store }: { readonly store: OsmMapStore }) => {
  const { bearingDeg } = store;
  return (
    <button
      type="button"
      onClick={store.resetNorth}
      aria-label={osmMapT.hud.compass(bearingDeg)}
      title={osmMapT.hud.compass(bearingDeg)}
      className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full bg-neutral-900/70 text-neutral-200 shadow-lg backdrop-blur transition-transform hover:scale-110 active:scale-95"
    >
      <svg
        viewBox={`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}
        className="size-9 transition-transform duration-150"
        style={{ transform: `rotate(${-bearingDeg}deg)` }}
        aria-hidden="true"
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.35}
        />
        <polygon
          points={`${CENTER},${CENTER - NEEDLE_LENGTH} ${CENTER + NEEDLE_HALF_WIDTH},${CENTER} ${CENTER - NEEDLE_HALF_WIDTH},${CENTER}`}
          fill="#ef4444"
        />
        <polygon
          points={`${CENTER},${CENTER + NEEDLE_LENGTH} ${CENTER + NEEDLE_HALF_WIDTH},${CENTER} ${CENTER - NEEDLE_HALF_WIDTH},${CENTER}`}
          fill="currentColor"
          fillOpacity={0.6}
        />
      </svg>
    </button>
  );
});
