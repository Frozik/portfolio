import { isEqual } from 'lodash-es';
import { useEffect, useRef, useState } from 'react';

export function useDeepEqualMemo<T>(value: T) {
  const [previousUniqValue, setPreviousUniqValue] = useState<T | undefined>(undefined);

  const previousUniqValueRef = useRef<T | undefined>(previousUniqValue);
  previousUniqValueRef.current = previousUniqValue;

  useEffect(() => {
    if (isEqual(value, previousUniqValueRef.current)) {
      return;
    }

    setPreviousUniqValue(value);
  }, [value]);

  return previousUniqValue ?? value;
}
