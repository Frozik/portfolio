import { isEqualWith } from 'lodash-es';

interface IComparable {
  equals(other: unknown): boolean;
}

const isComparable = (value: unknown): value is IComparable =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Partial<IComparable>).equals === 'function';

/**
 * Structural equality that knows Temporal values: lodash alone sees no fields on them, so
 * any two instants would compare equal.
 */
export function sameValue(left: unknown, right: unknown): boolean {
  return isEqualWith(left, right, (first: unknown, second: unknown) => {
    if (isComparable(first) && isComparable(second)) {
      return first.constructor === second.constructor && first.equals(second);
    }
    return undefined;
  });
}
