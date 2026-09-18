import { Crosshair } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { cn } from '@frozik/components/components/cn';

import type { SpaceGolfStore } from '../../application/SpaceGolfStore';
import { MAX_FORESIGHT } from '../../domain/constants';
import { spaceGolfT } from '../translations';

const ICON_SIZE_PX = 14;
const LEVELS = Array.from({ length: MAX_FORESIGHT }, (_, index) => index + 1);

/**
 * How far the ball's foresight has grown: a pip for every bonus there is to
 * take, lit in the bonus's own blue for the ones this ball has — the same
 * blue as the compass's arrow to the bonus. A burst ball loses them all.
 */
export const ForesightStatus = observer(({ store }: { readonly store: SpaceGolfStore }) => (
  <span
    className="flex h-9 items-center gap-1.5 rounded-lg bg-black/50 px-2.5"
    role="img"
    aria-label={spaceGolfT.hud.foresight(store.foresight, MAX_FORESIGHT)}
    title={spaceGolfT.hud.foresight(store.foresight, MAX_FORESIGHT)}
  >
    <span className={cn('flex', store.foresight > 0 ? 'text-sky-300' : 'text-neutral-500')}>
      <Crosshair size={ICON_SIZE_PX} aria-hidden="true" />
    </span>
    <span className="flex items-center gap-1">
      {LEVELS.map(level => (
        <span
          key={level}
          className={cn(
            'size-1.5 rounded-full transition-colors duration-300',
            level <= store.foresight ? 'bg-sky-300' : 'bg-neutral-600'
          )}
        />
      ))}
    </span>
  </span>
));
