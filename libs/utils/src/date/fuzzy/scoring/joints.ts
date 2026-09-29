import { isNil } from 'lodash-es';

import { ESeparator } from '../lexer/lexeme';
import type { Token } from '../lexer/token';
import { ETokenKind } from '../lexer/token';

const DATE_SEPARATORS: ReadonlySet<ESeparator> = new Set([
  ESeparator.Dash,
  ESeparator.Slash,
  ESeparator.Dot,
]);

function isDateSeparator(joint: ESeparator | undefined): boolean {
  return !isNil(joint) && DATE_SEPARATORS.has(joint);
}

/** Whether the number at the position is joined to a neighbour the way "15" is in "15/03". */
export function isJoinedIntoDate(tokens: readonly Token[], position: number): boolean {
  return (
    tokens[position]?.kind === ETokenKind.Number &&
    [tokens[position], tokens[position + 1]].some(token => isDateSeparator(token?.joint))
  );
}
