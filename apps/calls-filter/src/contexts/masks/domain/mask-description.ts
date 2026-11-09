import type { TPattern } from './pattern';

/** A mask read aloud: fixed text, a repeated symbol, or a stretch of anything. */
export type TMaskToken =
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'repeat';
      readonly text: string;
      readonly min: number;
      readonly max: number | null;
    }
  | { readonly kind: 'any'; readonly min: number; readonly max: number | null };

/** Merges runs of single literals into one text, so «+7 921» reads as one piece. */
export function describePattern(pattern: TPattern): readonly TMaskToken[] {
  const tokens: TMaskToken[] = [];
  for (const element of pattern) {
    const last = tokens.at(-1);
    if (element.symbol.kind === 'any') {
      tokens.push({ kind: 'any', min: element.min, max: element.max });
    } else if (element.min === 1 && element.max === 1) {
      if (last?.kind === 'text') {
        tokens[tokens.length - 1] = { kind: 'text', text: last.text + element.symbol.value };
      } else {
        tokens.push({ kind: 'text', text: element.symbol.value });
      }
    } else {
      tokens.push({
        kind: 'repeat',
        text: element.symbol.value,
        min: element.min,
        max: element.max,
      });
    }
  }
  return tokens;
}

/** Examples of what a mask takes: the shortest match, then one with every optional part filled. */
export function exampleOf(pattern: TPattern, filler: string): string {
  return pattern
    .map(element =>
      (element.symbol.kind === 'literal' ? element.symbol.value : filler).repeat(
        Math.max(element.min, element.max === null ? 1 : Math.min(element.max, element.min + 1))
      )
    )
    .join('');
}
