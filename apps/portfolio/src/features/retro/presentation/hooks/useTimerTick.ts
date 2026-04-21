import { useEffect } from 'react';

import type { RoomStore } from '../../application/RoomStore';
import { TIMER_TICK_MS } from '../../domain/constants';

export function useTimerTick(store: RoomStore): void {
  useEffect(() => {
    const id = setInterval(() => {
      store.tickTimer();
    }, TIMER_TICK_MS);
    return () => clearInterval(id);
  }, [store]);
}
