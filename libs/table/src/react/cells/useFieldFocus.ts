import type { RefObject } from 'react';
import { useEffect } from 'react';

/** A field takes the keyboard as soon as it mounts: the session already owns the cell. */
export function useFieldFocus(ref: RefObject<{ focus(): void } | null>): void {
  useEffect(() => {
    ref.current?.focus();
  }, [ref]);
}
