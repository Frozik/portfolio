import { isNil } from 'lodash-es';

import { ECharClass, charClassOf } from './char-class';
import type { ESeparator, ILexeme } from './lexeme';
import { separatorOf } from './lexeme';

enum EScanState {
  Idle = 'Idle',
  Digits = 'Digits',
  Clock = 'Clock',
  Signed = 'Signed',
  Word = 'Word',
  Mixed = 'Mixed',
}

enum ECharFate {
  Keep = 'Keep',
  Separate = 'Separate',
  Drop = 'Drop',
}

interface ITransition {
  readonly endsLexeme: boolean;
  readonly fate: ECharFate;
  readonly next: EScanState;
}

function grow(next: EScanState): ITransition {
  return { endsLexeme: false, fate: ECharFate.Keep, next };
}

function restart(next: EScanState): ITransition {
  return { endsLexeme: true, fate: ECharFate.Keep, next };
}

const END: ITransition = { endsLexeme: true, fate: ECharFate.Drop, next: EScanState.Idle };

const SPLIT: ITransition = { endsLexeme: true, fate: ECharFate.Separate, next: EScanState.Idle };

const BREAKS = {
  [ECharClass.Space]: END,
  [ECharClass.Colon]: SPLIT,
  [ECharClass.Dot]: SPLIT,
  [ECharClass.Comma]: SPLIT,
  [ECharClass.Dash]: SPLIT,
  [ECharClass.Slash]: SPLIT,
};

/** What the scanner does with a character of each class in each of its states. */
const TRANSITIONS: Readonly<Record<EScanState, Readonly<Record<ECharClass, ITransition>>>> = {
  [EScanState.Idle]: {
    ...BREAKS,
    [ECharClass.Digit]: grow(EScanState.Digits),
    [ECharClass.Letter]: grow(EScanState.Word),
    // A sign opens an offset ("-1w", "+02:00"); a dash that stays alone is a separator after all.
    [ECharClass.Dash]: grow(EScanState.Signed),
    [ECharClass.Plus]: grow(EScanState.Signed),
    [ECharClass.Apostrophe]: grow(EScanState.Mixed),
    [ECharClass.Other]: grow(EScanState.Mixed),
  },
  [EScanState.Digits]: {
    ...BREAKS,
    [ECharClass.Digit]: grow(EScanState.Digits),
    [ECharClass.Colon]: grow(EScanState.Clock),
    [ECharClass.Letter]: grow(EScanState.Mixed),
    [ECharClass.Plus]: grow(EScanState.Mixed),
    [ECharClass.Apostrophe]: grow(EScanState.Mixed),
    [ECharClass.Other]: grow(EScanState.Mixed),
  },
  [EScanState.Clock]: {
    ...BREAKS,
    [ECharClass.Digit]: grow(EScanState.Clock),
    [ECharClass.Letter]: grow(EScanState.Clock),
    [ECharClass.Colon]: grow(EScanState.Clock),
    [ECharClass.Dot]: grow(EScanState.Clock),
    // "14:30-05:00": after a time, a sign opens the offset of its time zone.
    [ECharClass.Dash]: grow(EScanState.Clock),
    [ECharClass.Plus]: grow(EScanState.Clock),
    [ECharClass.Apostrophe]: grow(EScanState.Clock),
    [ECharClass.Other]: grow(EScanState.Clock),
  },
  [EScanState.Signed]: {
    ...BREAKS,
    [ECharClass.Digit]: grow(EScanState.Signed),
    [ECharClass.Colon]: grow(EScanState.Signed),
    [ECharClass.Letter]: grow(EScanState.Mixed),
    [ECharClass.Plus]: grow(EScanState.Mixed),
    [ECharClass.Apostrophe]: grow(EScanState.Mixed),
    [ECharClass.Other]: grow(EScanState.Mixed),
  },
  [EScanState.Word]: {
    ...BREAKS,
    [ECharClass.Letter]: grow(EScanState.Word),
    [ECharClass.Digit]: grow(EScanState.Mixed),
    [ECharClass.Apostrophe]: grow(EScanState.Mixed),
    [ECharClass.Plus]: restart(EScanState.Mixed),
    [ECharClass.Other]: restart(EScanState.Mixed),
  },
  [EScanState.Mixed]: {
    ...BREAKS,
    [ECharClass.Digit]: grow(EScanState.Mixed),
    [ECharClass.Letter]: grow(EScanState.Mixed),
    [ECharClass.Plus]: grow(EScanState.Mixed),
    [ECharClass.Apostrophe]: grow(EScanState.Mixed),
    [ECharClass.Other]: grow(EScanState.Mixed),
  },
};

export function scan(text: string): readonly ILexeme[] {
  const lexemes: ILexeme[] = [];
  let state: EScanState = EScanState.Idle;
  let buffer = '';
  let joint: ESeparator | undefined;

  function endLexeme(): void {
    const loneSeparator = separatorOf(buffer);
    if (!isNil(loneSeparator)) {
      joint = loneSeparator;
    } else if (buffer.length > 0) {
      lexemes.push({ text: buffer, joint });
      joint = undefined;
    }
    buffer = '';
  }

  for (const char of text) {
    const transition: ITransition = TRANSITIONS[state][charClassOf(char)];

    if (transition.endsLexeme) {
      endLexeme();
    }
    if (transition.fate === ECharFate.Keep) {
      buffer += char;
    }
    if (transition.fate === ECharFate.Separate) {
      joint = separatorOf(char);
    }
    state = transition.next;
  }
  endLexeme();

  return lexemes;
}
