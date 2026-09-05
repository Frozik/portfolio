import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { useScorchedStore } from '../../application/useScorchedStore';
import type { RoundHighlight } from '../../domain/scoring';
import { GLASS_PANEL_CLASS } from '../constants';
import { getPlayerColor } from '../player-colors';
import { getPlayerDisplayName } from '../player-name';
import { scorchedT } from '../translations';

/** [§13] One celebration stat: who did it, and how much of it they did. */
const HighlightCard = memo(
  ({
    label,
    highlight,
    name,
  }: {
    readonly label: string;
    readonly highlight: RoundHighlight;
    readonly name: string;
  }) => (
    <li className={cn(GLASS_PANEL_CLASS, 'flex min-w-44 flex-col gap-1 text-left')}>
      <span className="text-[0.625rem] uppercase tracking-widest text-text-muted">{label}</span>
      <span className="flex items-center gap-2 text-sm font-medium text-text">
        <span
          aria-hidden="true"
          className="size-2.5 rounded-full"
          style={{ backgroundColor: getPlayerColor(highlight.playerId).hex }}
        />
        {name}
      </span>
      <span className="font-mono text-xs tabular-nums text-text-secondary">
        {scorchedT.round.damage(Math.round(highlight.amount))}
      </span>
    </li>
  )
);

/** The end of a round: who held the field, what the round will be remembered for, and onwards. */
export const RoundResultOverlay = observer(() => {
  const store = useScorchedStore();
  const [winnerId] = store.survivorIds;
  const winner = store.players.find(player => player.id === winnerId);
  const { biggestHit, topDamage } = store.roundHighlights;

  const handleContinue = useFunction(() => {
    store.continueAfterRound();
  });

  const resolveName = (playerId: number): string => {
    const player = store.players.find(candidate => candidate.id === playerId);

    return isNil(player) ? '' : getPlayerDisplayName(player);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/75 px-6 text-center backdrop-blur-md">
      <h2 className="text-2xl font-semibold tracking-wide text-text">{scorchedT.round.over}</h2>

      <p className="flex items-center gap-2 text-lg">
        {isNil(winner) ? (
          scorchedT.round.everyoneDied
        ) : (
          <>
            <span
              aria-hidden="true"
              className="size-3 rounded-full"
              style={{ backgroundColor: getPlayerColor(winner.id).hex }}
            />
            {scorchedT.round.winner(getPlayerDisplayName(winner))}
          </>
        )}
      </p>

      {isNil(biggestHit) && isNil(topDamage) ? (
        <p className="text-sm text-text-muted">{scorchedT.round.noHighlights}</p>
      ) : (
        <ul className="flex flex-wrap justify-center gap-3">
          {isNil(biggestHit) ? null : (
            <HighlightCard
              label={scorchedT.round.biggestHit}
              highlight={biggestHit}
              name={resolveName(biggestHit.playerId)}
            />
          )}
          {isNil(topDamage) ? null : (
            <HighlightCard
              label={scorchedT.round.mostDamage}
              highlight={topDamage}
              name={resolveName(topDamage.playerId)}
            />
          )}
        </ul>
      )}

      <Button size="lg" onClick={handleContinue} className="px-10">
        {scorchedT.continue}
      </Button>
    </div>
  );
});
