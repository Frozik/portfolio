import type { ISelection } from '@frozik/components/components/RichEditor/defs';

/** A field opened for editing starts with its whole value selected, so typing replaces it. */
export function selectAllOnFocus(value: string): ISelection | undefined {
  return value.length === 0 ? undefined : { start: 0, end: value.length };
}
