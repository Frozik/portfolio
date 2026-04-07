import type { TStructurallyCloneable } from '../../types';

export const FAIL_TAG = 'FAIL' as const;

export type ScopedFail<
  S extends Exclude<string, ''>,
  C extends Exclude<string, ''>,
  M extends undefined | TStructurallyCloneable = never,
> = FailStruct<`[${S}]: ${C}`, M>;

export type FailStruct<
  T extends string,
  M extends undefined | TStructurallyCloneable = undefined,
> = {
  tag: typeof FAIL_TAG;
  code: T;
  meta: M;
};

export type FailConstructor<P extends string = ''> = {
  <C extends string>(code: C): FailStruct<P extends '' ? C : `[${P}]: ${C}`>;
  <C extends string, M extends TStructurallyCloneable>(
    code: C,
    meta: M
  ): FailStruct<P extends '' ? C : `[${P}]: ${C}`, M>;
};

// biome-ignore lint/suspicious/noExplicitAny: wildcard type alias requires any
export type AnyFail = FailStruct<any, any>;
