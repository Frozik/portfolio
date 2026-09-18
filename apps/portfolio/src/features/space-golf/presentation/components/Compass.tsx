import { isNil } from 'lodash-es';
import { Navigation2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { SpaceGolfStore } from '../../application/SpaceGolfStore';
import { spaceGolfT } from '../translations';

const ARROW_SIZE_PX = 22;
const BONUS_ARROW_SIZE_PX = 13;

/**
 * Which way the cup lies from the ball, and how far: the one thing that
 * knows where an unseen cup is. With the cup on screen it is gone — the
 * flag speaks for itself there. A smaller blue arrow points at the bonus
 * while that is out of sight, whether the cup is or not.
 */
export const Compass = observer(({ store }: { readonly store: SpaceGolfStore }) => {
  const { compass } = store.view;
  if (isNil(compass) || (compass.cupOnScreen && isNil(compass.bonusAngleDegrees))) {
    return null;
  }
  return (
    <div
      className="flex flex-col items-center gap-0.5 rounded-full bg-black/55 px-3 py-2 font-mono text-xs tabular-nums text-neutral-200"
      role="img"
      aria-label={spaceGolfT.hud.compass(Math.round(compass.distanceMeters))}
    >
      {!compass.cupOnScreen && (
        <span
          className="flex transition-transform duration-150"
          style={{ transform: `rotate(${compass.angleDegrees}deg)` }}
        >
          <Navigation2 size={ARROW_SIZE_PX} aria-hidden="true" />
        </span>
      )}
      {!isNil(compass.bonusAngleDegrees) && (
        <span
          className="flex text-sky-300 transition-transform duration-150"
          style={{ transform: `rotate(${compass.bonusAngleDegrees}deg)` }}
        >
          <Navigation2 size={BONUS_ARROW_SIZE_PX} aria-hidden="true" />
        </span>
      )}
      {!compass.cupOnScreen && (
        <span>{spaceGolfT.hud.meters(Math.round(compass.distanceMeters))}</span>
      )}
    </div>
  );
});
