import { useEffect } from 'react';

import type { RoomStore } from '../../application/RoomStore';
import { TIMER_TICK_MS } from '../../domain/constants';

export function useTimerTick(store: RoomStore): void {
  useEffect(() => {
    const id = setInterval(() => {
      store.timer.tick();
    }, TIMER_TICK_MS);
    return () => clearInterval(id);
  }, [store]);
}
