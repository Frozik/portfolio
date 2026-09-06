import { ESeparatorKind } from './types';

export enum EFsmState {
  Initial = 'Initial',
  ReadingDigits = 'ReadingDigits',
  ReadingWord = 'ReadingWord',
  ReadingMixed = 'ReadingMixed',
}

/** The character-level scan that cuts raw input into digit runs, words and separators. */
export const SEPARATOR_SET = new Set<string>([
  ESeparatorKind.Colon,
  ESeparatorKind.Dash,
  ESeparatorKind.Slash,
  ESeparatorKind.Dot,
]);

export function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

export function isLetter(char: string): boolean {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
}

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

function isSeparator(char: string): boolean {
  return SEPARATOR_SET.has(char);
}

/**
 * FSM-based tokenizer that scans input character by character.
 * Produces raw token strings and separator tokens, then classifies them.
 */
export function fsmScan(input: string): string[] {
  const rawParts: string[] = [];
  let state = EFsmState.Initial;
  let buffer = '';

  function emit(): void {
    if (buffer.length > 0) {
      rawParts.push(buffer);
      buffer = '';
    }
    state = EFsmState.Initial;
  }

  for (let index = 0; index < input.length; index++) {
    const char = input[index];

    if (char === ',') {
      emit();
      continue;
    }

    switch (state) {
      case EFsmState.Initial: {
        if (isWhitespace(char)) {
          continue;
        }
        if (char === "'") {
          buffer = char;
          state = EFsmState.ReadingMixed;
          continue;
        }
        if (isDigit(char)) {
          buffer = char;
          state = EFsmState.ReadingDigits;
          continue;
        }
        if (char === '+' || char === '-') {
          buffer = char;
          state = EFsmState.ReadingMixed;
          continue;
        }
        if (isLetter(char)) {
          buffer = char;
          state = EFsmState.ReadingWord;
          continue;
        }
        if (isSeparator(char)) {
          rawParts.push(char);
          continue;
        }
        buffer = char;
        state = EFsmState.ReadingMixed;
        continue;
      }

      case EFsmState.ReadingDigits: {
        if (isDigit(char)) {
          buffer += char;
          continue;
        }
        if (isLetter(char)) {
          buffer += char;
          state = EFsmState.ReadingMixed;
          continue;
        }
        if (isSeparator(char)) {
          emit();
          rawParts.push(char);
          continue;
        }
        if (isWhitespace(char)) {
          emit();
          continue;
        }
        buffer += char;
        state = EFsmState.ReadingMixed;
        continue;
      }

      case EFsmState.ReadingWord: {
        if (isLetter(char) || char === '-') {
          buffer += char;
          continue;
        }
        if (isDigit(char)) {
          buffer += char;
          state = EFsmState.ReadingMixed;
          continue;
        }
        if (isWhitespace(char)) {
          emit();
          continue;
        }
        if (isSeparator(char)) {
          emit();
          rawParts.push(char);
          continue;
        }
        if (char === "'") {
          buffer += char;
          state = EFsmState.ReadingMixed;
          continue;
        }
        emit();
        buffer = char;
        state = EFsmState.ReadingMixed;
        continue;
      }

      case EFsmState.ReadingMixed: {
        if (isDigit(char) || isLetter(char)) {
          buffer += char;
          continue;
        }
        if (isWhitespace(char)) {
          emit();
          continue;
        }
        if (isSeparator(char)) {
          emit();
          rawParts.push(char);
          continue;
        }
        buffer += char;
        continue;
      }
    }
  }

  emit();
  return rawParts;
}
