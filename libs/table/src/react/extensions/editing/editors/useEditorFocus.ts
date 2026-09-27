import type { RefObject } from 'react';
import { useEffect } from 'react';

/** Editors take the keyboard as soon as they mount; the session already owns the cell. */
export function useEditorFocus(ref: RefObject<{ focus(): void } | null>): void {
  useEffect(() => {
    ref.current?.focus();
  }, [ref]);
}
