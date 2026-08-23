import { useEffect, useState } from 'react';

import { STAGE_CURTAIN_DURATION_MS } from '../constants';

export interface IStageCurtainState {
  readonly isMounted: boolean;
  readonly isOpening: boolean;
}

/** Unmounting on the status change alone would make the curtain vanish instead of retracting. */
export function useStageCurtain(isStageIntro: boolean): IStageCurtainState {
  const [isMounted, setIsMounted] = useState(isStageIntro);

  useEffect(() => {
    if (isStageIntro) {
      setIsMounted(true);

      return undefined;
    }

    const timeoutId = window.setTimeout(() => setIsMounted(false), STAGE_CURTAIN_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isStageIntro]);

  return { isMounted, isOpening: !isStageIntro };
}
