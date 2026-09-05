import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import { useScorchedStore } from '../../application/useScorchedStore';
import { GLASS_PANEL_CLASS } from '../constants';
import { getPlayerDisplayName } from '../player-name';
import { scorchedT } from '../translations';
import { PlayerSwatch } from './PlayerSwatch';

const NO_KILLS = 0;

/** The final table: aggregate kills take the match, points break the tie [WIKI §8]. */
export const MatchResultOverlay = observer(() => {
  const store = useScorchedStore();
  const [champion] = store.world.standings;
  const championPlayer = store.world.players.find(player => player.id === champion?.playerId);
  const hasWinner = !isNil(champion) && champion.kills > NO_KILLS;

  const handlePlayAgain = useFunction(() => {
    store.startMatch();
  });

  const handleChangePlayers = useFunction(() => {
    store.returnToSetup();
  });

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/80 px-6 text-center backdrop-blur-md">
      <h2 className="text-3xl font-semibold tracking-wide text-text">{scorchedT.match.over}</h2>

      <p className="text-lg text-text-secondary">
        {hasWinner && !isNil(championPlayer)
          ? scorchedT.match.champion(getPlayerDisplayName(championPlayer))
          : scorchedT.match.noWinner}
      </p>

      <ul className={cn(GLASS_PANEL_CLASS, 'flex w-full max-w-sm flex-col gap-1.5')}>
        <li className="flex items-center gap-3 text-[0.625rem] uppercase tracking-widest text-text-muted">
          <span className="flex-1 text-left">{scorchedT.roster.name}</span>
          <span className="w-14 text-right">{scorchedT.match.kills}</span>
          <span className="w-16 text-right">{scorchedT.match.points}</span>
        </li>

        {store.world.standings.map(standing => {
          const player = store.world.players.find(candidate => candidate.id === standing.playerId);

          return (
            <li key={standing.playerId} className="flex items-center gap-3 text-sm">
              <PlayerSwatch playerId={standing.playerId} className="size-2.5 shrink-0" />
              <span className="flex-1 truncate text-left text-text">
                {isNil(player) ? '' : getPlayerDisplayName(player)}
              </span>
              <span className="w-14 text-right font-mono tabular-nums">{standing.kills}</span>
              <span className="w-16 text-right font-mono tabular-nums text-text-secondary">
                {Math.round(standing.points)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={handlePlayAgain} className="px-10">
          {scorchedT.playAgain}
        </Button>
        <Button size="lg" variant="secondary" onClick={handleChangePlayers}>
          {scorchedT.match.changePlayers}
        </Button>
      </div>
    </div>
  );
});
