import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useLeave } from './use-leave';

/**
 * Leaves a screen whose group is gone — deleted while the screen lay under another, or never there
 * for a stale link — as soon as it is in front, rather than standing empty.
 */
export function useLeaveWhenGone(gone: boolean): void {
  const leave = useLeave();
  useFocusEffect(
    useCallback(() => {
      if (gone) {
        leave();
      }
    }, [gone, leave])
  );
}
