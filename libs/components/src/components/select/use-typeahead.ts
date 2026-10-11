import { useEffect, useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

/** How long typed letters keep adding up before the next one starts a new search. */
export const TYPEAHEAD_RESET_MS = 600;

/** The letters typed in a quick run, as a native select collects them. */
export function useTypeahead(): (char: string) => string {
  const typed = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return useEventCallback((char: string) => {
    clearTimeout(timer.current);
    typed.current += char;
    timer.current = setTimeout(() => {
      typed.current = '';
    }, TYPEAHEAD_RESET_MS);
    return typed.current;
  });
}
