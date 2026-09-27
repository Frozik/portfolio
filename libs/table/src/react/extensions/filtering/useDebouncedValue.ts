import { useEffect, useRef, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

/**
 * Local text that follows the model and commits after a pause in typing;
 * a model change from elsewhere (clear, restore) replaces what is typed.
 */
export function useDebouncedValue(
  value: string,
  commit: (value: string) => void,
  delayMs: number
): readonly [string, (next: string) => void] {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef(false);

  useEffect(() => {
    if (!pending.current) {
      setDraft(value);
    }
  }, [value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const change = useEventCallback((next: string) => {
    setDraft(next);
    pending.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pending.current = false;
      commit(next);
    }, delayMs);
  });

  return [draft, change];
}
