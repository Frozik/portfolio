import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';

export interface IListboxOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  readonly disabled?: boolean;
  /** The heading of the group this option sits in; neighbours under one heading form a group. */
  readonly group?: string;
  /** A picture before the label, in the list and in the field: an icon, a colour swatch. */
  readonly decoration?: ReactNode;
}

export type TListboxMove = 'next' | 'previous' | 'first' | 'last';

/** The key that moves the active option, if it is one. */
export function listboxMoveOf(key: string): TListboxMove | undefined {
  switch (key) {
    case 'ArrowDown':
      return 'next';
    case 'ArrowUp':
      return 'previous';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    default:
      return undefined;
  }
}

/** Keys that open a closed list from its field. */
export function isOpeningKey(key: string): boolean {
  return !isNil(listboxMoveOf(key)) || key === 'Enter' || key === ' ';
}

function enabledIndices(options: readonly IListboxOption<string>[]): readonly number[] {
  return options.flatMap((option, index) => (option.disabled === true ? [] : [index]));
}

/** The option a key moves to; disabled options are skipped, the ends do not wrap. */
export function moveActive(
  options: readonly IListboxOption<string>[],
  active: number | undefined,
  move: TListboxMove
): number | undefined {
  const enabled = enabledIndices(options);
  if (enabled.length === 0) {
    return undefined;
  }
  switch (move) {
    case 'first':
      return enabled[0];
    case 'last':
      return enabled.at(-1);
    case 'next':
      return isNil(active) ? enabled[0] : (enabled.find(index => index > active) ?? active);
    case 'previous':
      return isNil(active) ? enabled.at(-1) : (enabled.findLast(index => index < active) ?? active);
    default:
      return assertNever(move);
  }
}

/** Typing a printable character jumps to an option, as in a native select. */
export function isTypeaheadKey(event: {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}): boolean {
  return [...event.key].length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

/**
 * The option whose label starts with what was typed, looking past the active
 * one first. Repeating one letter cycles through the options it starts, as a
 * native select does.
 */
export function typeaheadMatch(
  options: readonly IListboxOption<string>[],
  typed: string,
  active: number | undefined,
  locale: string
): number | undefined {
  const query = typed.toLocaleLowerCase(locale);
  const isRepeat = query.length > 1 && [...query].every(char => char === query[0]);
  const prefix = isRepeat ? (query[0] ?? '') : query;
  const start = isNil(active) ? 0 : isRepeat || query.length === 1 ? active + 1 : active;
  const order = enabledIndices(options);
  const rotated = [
    ...order.filter(index => index >= start),
    ...order.filter(index => index < start),
  ];
  return rotated.find(index =>
    (options[index]?.label ?? '').toLocaleLowerCase(locale).startsWith(prefix)
  );
}

/** The suggestions for typed text: those starting with it first, then those containing it. */
export function matchingSuggestions(
  suggestions: readonly string[],
  typed: string,
  locale: string
): readonly string[] {
  const query = typed.trim().toLocaleLowerCase(locale);
  if (query.length === 0) {
    return suggestions;
  }
  const lowered = suggestions.map(suggestion => suggestion.toLocaleLowerCase(locale));
  const starting = suggestions.filter((_, index) => lowered[index]?.startsWith(query));
  const containing = suggestions.filter(
    (_, index) => !lowered[index]?.startsWith(query) && lowered[index]?.includes(query)
  );
  return [...starting, ...containing];
}
