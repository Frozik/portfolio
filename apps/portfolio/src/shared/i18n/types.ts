import type { ReactNode } from 'react';

export type Language = 'en' | 'ru';

export type TranslationOf<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => string
    ? (...args: A) => string
    : T[K] extends string
      ? string
      : T[K] extends readonly unknown[]
        ? TranslationOf<T[K]>
        : T[K] extends Record<string, unknown>
          ? TranslationOf<T[K]>
          : T[K] extends ReactNode
            ? ReactNode
            : T[K];
};
