// Local Result<T,E> — `@frozik/utils` does not export an equivalent at the
// time this app was added (only `value-descriptors`, which model async UI
// state). Keep this minimal and synchronous.

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
