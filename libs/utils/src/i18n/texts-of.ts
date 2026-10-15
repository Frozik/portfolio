/** A translation table shaped like another: strings, word-making functions, lists and nested tables. */
export type TextsOf<T> = {
  readonly [K in keyof T]: T[K] extends (...args: infer A) => string
    ? (...args: A) => string
    : T[K] extends string
      ? string
      : T[K] extends readonly unknown[]
        ? TextsOf<T[K]>
        : T[K] extends Record<string, unknown>
          ? TextsOf<T[K]>
          : T[K];
};
