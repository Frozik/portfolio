import { useCallback, useRef } from 'react';

// biome-ignore lint/suspicious/noExplicitAny: generic callback wrapper requires any for arbitrary signatures
export function useFunction<T extends (...args: any[]) => any>(handler: T): T {
  const ref = useRef<T>(handler);

  ref.current = handler;

  return useCallback(((...args) => ref.current(...args)) as T, []);
}
