import { useEffect, useRef, useState } from 'react';

import { CARD_FLIP_DURATION_MS } from '../../domain/constants';
import type { RetroPhase } from '../../domain/types';

export type CardFlipState = 'hidden' | 'revealing' | 'revealed';

export function useCardFlipState(phase: RetroPhase, isOwn: boolean): CardFlipState {
  const [state, setState] = useState<CardFlipState>(
    phase === 'brainstorm' && !isOwn ? 'hidden' : 'revealed'
  );
  const prevPhaseRef = useRef(phase);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev === 'brainstorm' && phase !== 'brainstorm' && !isOwn) {
      setState('revealing');
      const id = setTimeout(() => setState('revealed'), CARD_FLIP_DURATION_MS);
      prevPhaseRef.current = phase;
      return () => clearTimeout(id);
    }
    if (phase === 'brainstorm' && !isOwn) {
      setState('hidden');
    } else {
      setState('revealed');
    }
    prevPhaseRef.current = phase;
    return undefined;
  }, [phase, isOwn]);

  return state;
}
