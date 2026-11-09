/** One position of a mask: a fixed symbol or any symbol of the alphabet. */
export type TPatternSymbol =
  | { readonly kind: 'literal'; readonly value: string }
  | { readonly kind: 'any' };

/** A symbol repeated `min` to `max` times; `max: null` is unbounded (the mask's `*` or `{n,}`). */
export interface IPatternElement {
  readonly symbol: TPatternSymbol;
  readonly min: number;
  readonly max: number | null;
}

/**
 * What a number mask and a name mask have in common once parsed: a sequence of repeated
 * symbols that must cover the whole input. Numbers use digits as the alphabet, names the
 * normalized characters.
 */
export type TPattern = readonly IPatternElement[];

export function minimumLength(pattern: TPattern): number {
  return pattern.reduce((total, element) => total + element.min, 0);
}

function isExact(pattern: TPattern): boolean {
  return pattern.every(element => element.symbol.kind === 'literal' && element.min === element.max);
}

/** The text an exact pattern stands for; `null` when the pattern has wildcards. */
export function exactText(pattern: TPattern): string | null {
  if (!isExact(pattern)) {
    return null;
  }
  return pattern
    .map(element =>
      element.symbol.kind === 'literal' ? element.symbol.value.repeat(element.min) : ''
    )
    .join('');
}

export function literalPattern(text: string): TPattern {
  return Array.from(text, value => ({ symbol: { kind: 'literal', value }, min: 1, max: 1 }));
}
