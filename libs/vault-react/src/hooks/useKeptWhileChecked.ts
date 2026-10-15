import { useEffect, useRef, useState } from 'react';

/**
 * What was typed into an unlock field: it stays in sight, the field locked, while it is
 * checked; a refusal clears it for the next try. A success leaves the screen anyway.
 */
export function useKeptWhileChecked(checking: boolean): readonly [string, (text: string) => void] {
  const [text, setText] = useState('');
  const wasChecking = useRef(checking);
  useEffect(() => {
    if (wasChecking.current && !checking) {
      setText('');
    }
    wasChecking.current = checking;
  }, [checking]);
  return [text, setText];
}
