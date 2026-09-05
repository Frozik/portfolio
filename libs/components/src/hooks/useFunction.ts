import { useCallback, useRef } from 'react';

// oxlint-disable-next-line typescript/no-explicit-any -- generic callback wrapper requires any for arbitrary signatures
export function useFunction<T extends (...args: any[]) => any>(handler: T): T {
  const ref = useRef<T>(handler);

  ref.current = handler;

  return useCallback(((...args) => ref.current(...args)) as T, []);
}
