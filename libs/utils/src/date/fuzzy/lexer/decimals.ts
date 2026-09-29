import { classify } from './classify';
import type { ILexeme } from './lexeme';
import { ESeparator } from './lexeme';
import { ETokenKind } from './token';

const WHOLE_PART = /^[+-]?\d+$/;
const DIGITS = /^\d+$/;

const DECIMAL_MARKS: ReadonlySet<ESeparator | undefined> = new Set([
  ESeparator.Dot,
  ESeparator.Comma,
]);

function startsWith(kind: ETokenKind, lexeme: ILexeme | undefined): boolean {
  return lexeme !== undefined && classify({ text: lexeme.text })[0].kind === kind;
}

/**
 * The scanner cuts "1.5h" at the dot, as it must cut "15.03". What tells the two apart is
 * what the fraction runs into: a unit — "1.5h", "1,5 hours" — makes the pair one number.
 */
function isFraction(lexemes: readonly ILexeme[], position: number): boolean {
  const [whole, fraction, after] = lexemes.slice(position - 1, position + 2);

  return (
    WHOLE_PART.test(whole?.text ?? '') &&
    DECIMAL_MARKS.has(fraction.joint) &&
    (startsWith(ETokenKind.Offset, fraction) ||
      (DIGITS.test(fraction.text) && startsWith(ETokenKind.Unit, after)))
  );
}

export function joinDecimals(lexemes: readonly ILexeme[]): readonly ILexeme[] {
  return lexemes.reduce<readonly ILexeme[]>((joined, lexeme, position) => {
    const whole = joined.at(-1);

    return whole !== undefined && isFraction(lexemes, position)
      ? [...joined.slice(0, -1), { text: `${whole.text}.${lexeme.text}`, joint: whole.joint }]
      : [...joined, lexeme];
  }, []);
}
