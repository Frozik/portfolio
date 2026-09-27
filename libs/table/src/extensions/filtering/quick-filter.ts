import type { TAnyColumn } from '../../core/columns/column';
import { columnText } from '../../core/columns/column';
import type { IQuickFilter } from '../../core/rows/row-query';

export type TQuickMatcher = (text: string) => boolean;

const WHITESPACE = /\s+/;

/** The columns whose text the quick filter searches: what reads as words, not numbers or dates. */
export function isQuickFilterColumn<TRow>(column: TAnyColumn<TRow>): boolean {
  return column.kind === 'text' || column.kind === 'custom';
}

/** Space-separated tokens must all occur (`and`); `regexp` mode tests the whole text. `undefined` means invalid. */
export function compileQuickFilter(quick: IQuickFilter): TQuickMatcher | undefined {
  const text = quick.text.trim();
  if (text === '') {
    return () => true;
  }
  if (quick.mode === 'regexp') {
    try {
      const regexp = new RegExp(text, quick.caseSensitive ? '' : 'i');
      return candidate => regexp.test(candidate);
    } catch {
      return undefined;
    }
  }
  const tokens = text
    .split(WHITESPACE)
    .map(token => (quick.caseSensitive ? token : token.toLowerCase()));
  return candidate => {
    const haystack = quick.caseSensitive ? candidate : candidate.toLowerCase();
    return tokens.every(token => haystack.includes(token));
  };
}

export function quickFilterText<TRow>(row: TRow, columns: readonly TAnyColumn<TRow>[]): string {
  return columns.map(column => columnText(column, row)).join(' ');
}
