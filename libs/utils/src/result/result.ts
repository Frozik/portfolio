/** An expected outcome as a value: the success carries `value`, the failure a discriminated `error`. */
export type TResult<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): TResult<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): TResult<never, E> {
  return { ok: false, error };
}
