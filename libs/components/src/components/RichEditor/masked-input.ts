import { isNil } from 'lodash-es';

import type { ITextSegment, TInputNormalizer, TSegmentRenderer } from './defs';

/** What a masked field accepts and how it groups it; plain data. */
export interface IMaskPattern {
  /** One character the field takes, tested alone. */
  readonly accepts: (character: string, index: number) => boolean;
  readonly upperCase?: boolean;
  readonly maxLength: number;
  /** Positions before which a gap is shown: `[4, 8, 12]` groups a card number in fours. */
  readonly gaps?: readonly number[];
}

/** A pattern, or one that follows the value: a card number's groups depend on its network. */
export type TMask = IMaskPattern | ((value: string) => IMaskPattern);

export function maskFor(mask: TMask, value: string): IMaskPattern {
  return typeof mask === 'function' ? mask(value) : mask;
}

const DIGIT = /^\d$/;
const ALPHANUMERIC = /^[A-Za-z\d]$/;
const GROUP_OF_FOUR = 4;

function everyN(step: number, maxLength: number): readonly number[] {
  return Array.from({ length: Math.ceil(maxLength / step) - 1 }, (_, index) => (index + 1) * step);
}

/** The masks the library knows without any domain knowledge. */
export const MASKS = {
  /** E.164: digits, and a `+` only in front. */
  phone: {
    accepts: (character, index) => DIGIT.test(character) || (character === '+' && index === 0),
    maxLength: 16,
  },
  /** ISO 13616: letters and digits, upper case, in fours. */
  iban: {
    accepts: character => ALPHANUMERIC.test(character),
    upperCase: true,
    maxLength: 34,
    gaps: everyN(GROUP_OF_FOUR, 34),
  },
  /** ISO 9362 SWIFT/BIC. */
  bic: { accepts: character => ALPHANUMERIC.test(character), upperCase: true, maxLength: 11 },
  /** Any country's account number: letters and digits, as banks print them. */
  accountNumber: {
    accepts: character => ALPHANUMERIC.test(character),
    upperCase: true,
    maxLength: 34,
  },
  digits: { accepts: character => DIGIT.test(character), maxLength: 32 },
} as const satisfies Readonly<Record<string, IMaskPattern>>;

/** Keeps what the pattern accepts, upper-cases if asked, caps the length; the caret follows its characters. */
export function createMaskNormalizer(mask: TMask): TInputNormalizer {
  return (value, selection) => {
    const pattern = maskFor(mask, value);
    let kept = '';
    let caretStart = 0;
    let caretEnd = 0;
    [...value].forEach((raw, index) => {
      const character = pattern.upperCase === true ? raw.toUpperCase() : raw;
      if (kept.length < pattern.maxLength && pattern.accepts(character, kept.length)) {
        kept += character;
      }
      if (index < selection.start) {
        caretStart = kept.length;
      }
      if (index < selection.end) {
        caretEnd = kept.length;
      }
    });
    return { value: kept, selection: { start: caretStart, end: caretEnd } };
  };
}

/** Groups drawn as a margin before each group's first character: the text itself has no separators. */
export function createMaskSegmentRenderer(mask: TMask, gapClassName: string): TSegmentRenderer {
  return text => {
    const gaps = new Set(maskFor(mask, text).gaps ?? []);
    const segments: ITextSegment[] = [];
    let run = '';
    [...text].forEach((character, index) => {
      if (gaps.has(index)) {
        if (run !== '') {
          segments.push({ text: run });
        }
        segments.push({ text: character, className: gapClassName });
        run = '';
      } else {
        run += character;
      }
    });
    return run === '' ? segments : [...segments, { text: run }];
  };
}

/** What a person typing `text` would end up with: the agent tools enter through it. */
export function enterMaskedText(text: string, mask: TMask): string {
  const normalized = createMaskNormalizer(mask)(text, { start: text.length, end: text.length });
  return isNil(normalized) ? '' : normalized.value;
}
