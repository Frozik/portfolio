import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import { useTanksStore } from '../../application/useTanksStore';
import { tanksT } from '../translations';

/** §10's start menu: the feature title, the best score so far and a single Start action. */
export const StartMenuOverlay = observer(() => {
  const store = useTanksStore();
  const { bestScore } = store;

  const handleStart = useFunction(() => {
    store.startGame();
  });

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 px-6 text-center">
      <h2 className="text-3xl font-semibold tracking-wide text-text">{tanksT.title}</h2>
      <p className="text-sm text-text-secondary">{tanksT.subtitle}</p>
      <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
        {tanksT.hud.bestScore} {bestScore}
      </p>
      <Button size="lg" onClick={handleStart}>
        {tanksT.start}
      </Button>
      <p className="text-xs text-text-muted">{tanksT.controlsHint}</p>
    </div>
  );
});
