import { isNil } from 'lodash-es';

import type { TE164Digits } from '../caller';
import type { INumberingMask } from './gen/numbering-codes';

function covers(node: INumberingMask, digits: TE164Digits): boolean {
  return digits.startsWith(node.mask.slice(1, -1));
}

/** Every mask covering a number, from its country code down to the deepest; empty when none does. */
export function numberingPathOf(
  roots: readonly INumberingMask[],
  digits: TE164Digits
): readonly INumberingMask[] {
  const path: INumberingMask[] = [];
  let level = roots;
  for (;;) {
    const child = level.find(node => covers(node, digits));
    if (isNil(child)) {
      return path;
    }
    path.push(child);
    level = child.children ?? [];
  }
}

/**
 * What the catalogue knows about a number: the deepest mask covering it, with its country,
 * network, region or service; `null` when no country code matches.
 */
export function numberingOf(
  roots: readonly INumberingMask[],
  digits: TE164Digits
): INumberingMask | null {
  return numberingPathOf(roots, digits).at(-1) ?? null;
}
