import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import { useTanksStore } from '../../application/useTanksStore';
import { GAME_OVER_RISE_ANIMATION_CLASS } from '../constants';
import { tanksT } from '../translations';

/** The original rides "GAME OVER" up from the bottom of the field before the score settles. */
export const GameOverOverlay = observer(() => {
  const store = useTanksStore();
  const { score, bestScore } = store;

  const handlePlayAgain = useFunction(() => {
    store.returnToMenu();
  });

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/75 px-6 text-center">
      <h2
        className={cn(
          'font-mono text-3xl font-semibold uppercase tracking-[0.3em] text-error',
          GAME_OVER_RISE_ANIMATION_CLASS
        )}
      >
        {tanksT.gameOver}
      </h2>
      <dl className="flex flex-col items-center gap-1 text-sm">
        <dt className="text-[0.625rem] uppercase tracking-widest text-text-muted">
          {tanksT.finalScore}
        </dt>
        <dd className="font-mono text-2xl tabular-nums text-text">{score}</dd>
        <dt className="mt-2 text-[0.625rem] uppercase tracking-widest text-text-muted">
          {tanksT.hud.bestScore}
        </dt>
        <dd className="font-mono tabular-nums text-text-secondary">{bestScore}</dd>
      </dl>
      <Button size="lg" onClick={handlePlayAgain}>
        {tanksT.playAgain}
      </Button>
    </div>
  );
});
