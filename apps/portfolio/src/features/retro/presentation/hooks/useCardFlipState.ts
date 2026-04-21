import { useEffect, useRef, useState } from 'react';

import { CARD_FLIP_DURATION_MS } from '../../domain/constants';
import { ERetroPhase } from '../../domain/types';

export type CardFlipState = 'hidden' | 'revealing' | 'revealed';

export function useCardFlipState(phase: ERetroPhase, isOwn: boolean): CardFlipState {
  const [state, setState] = useState<CardFlipState>(
    phase === ERetroPhase.Brainstorm && !isOwn ? 'hidden' : 'revealed'
  );
  const prevPhaseRef = useRef(phase);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (prev === ERetroPhase.Brainstorm && phase !== ERetroPhase.Brainstorm && !isOwn) {
      setState('revealing');
      const id = setTimeout(() => setState('revealed'), CARD_FLIP_DURATION_MS);
      prevPhaseRef.current = phase;
      return () => clearTimeout(id);
    }
    if (phase === ERetroPhase.Brainstorm && !isOwn) {
      setState('hidden');
    } else {
      setState('revealed');
    }
    prevPhaseRef.current = phase;
    return undefined;
  }, [phase, isOwn]);

  return state;
}
