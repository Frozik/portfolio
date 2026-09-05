import { cn } from '@frozik/components/components/cn';
import { isNil } from 'lodash-es';
import { memo } from 'react';

import type { PlayerId } from '../../domain/types';
import { getPlayerColor } from '../player-colors';

/** The colour dot a player is known by everywhere — the one place a player colour is inlined. */
export const PlayerSwatch = memo(
  ({
    playerId,
    className,
  }: {
    readonly playerId: PlayerId | undefined;
    readonly className?: string;
  }) => (
    <span
      aria-hidden="true"
      className={cn('inline-block rounded-full', className)}
      style={{ backgroundColor: isNil(playerId) ? undefined : getPlayerColor(playerId).hex }}
    />
  )
);
