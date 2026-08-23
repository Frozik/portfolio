import { useFunction } from '@frozik/components/hooks/useFunction';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import { useTanksStore } from '../../application/useTanksStore';
import { tanksT } from '../translations';

export const PauseOverlay = observer(() => {
  const store = useTanksStore();

  const handleResume = useFunction(() => {
    store.togglePause();
  });

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/60 px-6 text-center">
      <h2 className="text-2xl font-semibold tracking-wide text-text">{tanksT.paused}</h2>
      <Button size="lg" variant="secondary" onClick={handleResume}>
        {tanksT.resume}
      </Button>
    </div>
  );
});
