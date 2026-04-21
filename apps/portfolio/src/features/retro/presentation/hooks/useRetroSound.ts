import { reaction } from 'mobx';
import { useEffect } from 'react';

import type { RoomStore } from '../../application/RoomStore';

export function useRetroSound(store: RoomStore): void {
  useEffect(() => {
    return reaction(
      () => store.timerSeverity,
      (severity, prev) => {
        if (severity === 'expired' && prev !== 'expired' && store.isFacilitator) {
          store.playTimerExpiredChime();
        }
      }
    );
  }, [store]);
}
