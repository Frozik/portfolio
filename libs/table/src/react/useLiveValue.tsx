import { observable, runInAction } from 'mobx';
import { useCallback, useEffect, useState } from 'react';

/**
 * Turns a plain React value into a stable observable getter, so a table
 * created once can follow props that change on later renders:
 * `clientRows({ rows: useLiveValue(trades) })`.
 */
export function useLiveValue<TValue>(value: TValue): () => TValue {
  const [box] = useState(() => observable.box(value, { deep: false }));
  useEffect(() => {
    runInAction(() => box.set(value));
  }, [box, value]);
  return useCallback(() => box.get(), [box]);
}
