import type { TStructurallyCloneable } from '../../types/serialization';

import type { FailConstructor } from './types';
import { FAIL_TAG } from './types';

const prefixSet = new Set<string>();

export const Fail: FailConstructor = ((code: string, meta?: TStructurallyCloneable) => {
  return {
    tag: FAIL_TAG,
    code,
    meta,
  };
}) as unknown as FailConstructor;

export function FailFactory<P extends string>(prefix: P): FailConstructor<P> {
  if (prefixSet.has(prefix)) {
    throw new Error(`Prefix ${prefix} already used`);
  }

  prefixSet.add(prefix);

  return ((code: unknown, meta: TStructurallyCloneable) =>
    Fail(`[${prefix}]: ${code}`, meta)) as FailConstructor<P>;
}
