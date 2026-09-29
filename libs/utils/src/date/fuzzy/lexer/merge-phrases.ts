import { isNil } from 'lodash-es';

import { PHRASES } from './phrases';
import type { Token } from './token';

interface IPhraseMatch {
  readonly tokens: readonly Token[];
  readonly length: number;
}

function phraseAt(tokens: readonly Token[], start: number): IPhraseMatch | undefined {
  for (const { length, read } of PHRASES) {
    const written = tokens.slice(start, start + length);
    const meanings = read(written);
    if (!isNil(meanings)) {
      const text = written.map(token => token.text).join(' ');
      return {
        tokens: meanings.map((meaning, place) => ({
          ...meaning,
          text,
          joint: place === 0 ? written[0].joint : undefined,
        })),
        length,
      };
    }
  }
  return undefined;
}

export function mergePhrases(tokens: readonly Token[]): readonly Token[] {
  const merged: Token[] = [];
  let position = 0;

  while (position < tokens.length) {
    const phrase = phraseAt(tokens, position);
    merged.push(...(phrase?.tokens ?? [tokens[position]]));
    position += phrase?.length ?? 1;
  }

  return merged;
}
