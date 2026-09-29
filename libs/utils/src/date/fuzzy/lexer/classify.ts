import { isNil } from 'lodash-es';

import type { ILexeme } from './lexeme';
import { ESeparator } from './lexeme';
import { SHAPES } from './shapes';
import type { Meaning, Token } from './token';
import { ETokenKind } from './token';
import { WORDS } from './vocabulary';

function readShape(word: string): readonly Meaning[] | undefined {
  for (const shape of SHAPES) {
    const match = shape.pattern.exec(word);
    const meanings = isNil(match) ? undefined : shape.read(...match.slice(1));
    if (!isNil(meanings)) {
      return meanings;
    }
  }
  return undefined;
}

function read(word: string): readonly Meaning[] {
  return WORDS.get(word) ?? readShape(word) ?? [{ kind: ETokenKind.Unknown }];
}

function written({ text, joint }: ILexeme, meanings: readonly Meaning[]): readonly Token[] {
  return meanings.map((meaning, index) => ({
    ...meaning,
    text,
    joint: index === 0 ? joint : undefined,
  }));
}

/**
 * "eom-4h": the scanner takes the dash for a separator; before an offset it is the minus.
 * A comma before an offset is only a comma; a slash or a colon has torn something apart.
 */
function offsetsJoined(lexeme: ILexeme, meanings: readonly Meaning[]): readonly Token[] {
  switch (lexeme.joint) {
    case ESeparator.Dash:
      return written(
        { text: lexeme.text },
        meanings.map(meaning =>
          meaning.kind === ETokenKind.Offset ? { ...meaning, amount: -meaning.amount } : meaning
        )
      );
    case ESeparator.Comma:
      return written(lexeme, meanings);
    default:
      return written(lexeme, [{ kind: ETokenKind.Unknown }]);
  }
}

export function classify(lexeme: ILexeme): readonly Token[] {
  const meanings = read(lexeme.text.toLowerCase());
  const isJoinedOffset = !isNil(lexeme.joint) && meanings[0].kind === ETokenKind.Offset;

  return isJoinedOffset ? offsetsJoined(lexeme, meanings) : written(lexeme, meanings);
}
