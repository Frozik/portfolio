import { useEffect, useRef } from 'react';

import type { ICellEdit } from '../column';

/** A session opened by typing starts from that key: the field replaces the value with what the key means, once, when it mounts. */
export function useInitialKey<TValue>(
  edit: ICellEdit<TValue>,
  draftOf: (key: string) => TValue
): void {
  const { initialKey, update } = edit;
  const consumed = useRef(false);
  useEffect(() => {
    if (!consumed.current && initialKey !== undefined) {
      consumed.current = true;
      update(draftOf(initialKey));
    }
  }, [initialKey, update, draftOf]);
}
