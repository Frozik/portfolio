import { isNil } from 'lodash-es';
import { Navigation2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { cn } from '@frozik/components/components/cn';

import type { SpaceGolfStore } from '../../application/SpaceGolfStore';
import type { BonusKind } from '../../domain/bonus';
import { spaceGolfT } from '../translations';

const ARROW_SIZE_PX = 22;
const BONUS_ARROW_SIZE_PX = 13;
/** The arrow to the bonus wears the bonus's own colour. */
const BONUS_ARROW_CLASS: Readonly<Record<BonusKind, string>> = {
  foresight: 'text-sky-300',
  grip: 'text-pink-300',
};

/**
 * Which way the cup lies from the ball, and how far: the one thing that
 * knows where an unseen cup is. With the cup on screen it is gone — the
 * flag speaks for itself there. A smaller arrow in the bonus's own colour points at
 * the bonus while that is out of sight, whether the cup is or not.
 */
export const Compass = observer(({ store }: { readonly store: SpaceGolfStore }) => {
  const { compass } = store.view;
  if (isNil(compass) || (compass.cupOnScreen && isNil(compass.bonus))) {
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
      {!isNil(compass.bonus) && (
        <span
          className={cn(
            'flex transition-transform duration-150',
            BONUS_ARROW_CLASS[compass.bonus.kind]
          )}
          style={{ transform: `rotate(${compass.bonus.angleDegrees}deg)` }}
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
