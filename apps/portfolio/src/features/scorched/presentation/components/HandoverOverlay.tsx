import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import { useScorchedStore } from '../../application/useScorchedStore';
import { getPlayerDisplayName } from '../player-name';
import { scorchedT } from '../translations';
import { PlayerSwatch } from './PlayerSwatch';

/**
 * The hot-seat handover card: it names the player taking over, stops the previous one from
 * firing by accident, and doubles as the pacing beat between two humans.
 */
export const HandoverOverlay = observer(() => {
  const store = useScorchedStore();
  const { activePlayer } = store.world;

  const handleReady = useFunction(() => {
    store.confirmHandover();
  });

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black/85 px-6 text-center backdrop-blur-md">
      <PlayerSwatch playerId={activePlayer?.id} className="size-10 ring-4 ring-white/10" />
      <h2 className="text-2xl font-semibold tracking-wide text-text">{scorchedT.handover.title}</h2>
      {isNil(activePlayer) ? null : (
        <p className="text-lg text-text-secondary">
          {scorchedT.handover.subtitle(getPlayerDisplayName(activePlayer))}
        </p>
      )}
      <Button size="lg" onClick={handleReady} className="px-10">
        {scorchedT.handover.ready}
      </Button>
    </div>
  );
});
