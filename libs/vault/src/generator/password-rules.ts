import { isNil, uniq } from 'lodash-es';

/**
 * What a site asks of a password, in Apple's Password Rules
 * language: each `required` is a set at least one character must come from;
 * every character comes from the required and allowed sets together.
 */
export interface IPasswordRules {
  readonly minLength: number | null;
  readonly maxLength: number | null;
  readonly maxConsecutive: number | null;
  readonly required: readonly (readonly string[])[];
  readonly allowed: readonly string[];
}

const FIRST_PRINTABLE = 0x21;
const LAST_PRINTABLE = 0x7e;

/** Printable ASCII without the space: a space at either end is trimmed by too many sites to generate one. */
export const ASCII_PRINTABLE: readonly string[] = Array.from(
  { length: LAST_PRINTABLE - FIRST_PRINTABLE + 1 },
  (_, index) => String.fromCharCode(FIRST_PRINTABLE + index)
);

const NAMED_CLASSES: Readonly<Record<string, readonly string[]>> = {
  upper: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
  lower: [...'abcdefghijklmnopqrstuvwxyz'],
  digit: [...'0123456789'],
  special: [...'-~!@#$%^&*_+=`|(){}[:;"\'<>,.?]'],
  'ascii-printable': ASCII_PRINTABLE,
  unicode: ASCII_PRINTABLE,
};

const CLASS_START = '[';
const CLASS_END = ']';
const RULE_END = ';';
const NAME_END = ':';
const CLASS_SEPARATOR = ',';

function isPrintable(character: string): boolean {
  const code = character.charCodeAt(0);
  return character.length === 1 && code >= FIRST_PRINTABLE && code <= LAST_PRINTABLE;
}

/**
 * Splits at `separator` outside custom classes. Inside one, `]]` is a `]`
 * followed by the end of the class: Apple writes `]` last in a class that has it.
 */
function splitOutsideClasses(text: string, separator: string): readonly string[] {
  const parts: string[] = [];
  let current = '';
  let inClass = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    if (inClass) {
      current += character;
      if (character === CLASS_END && text.charAt(index + 1) === CLASS_END) {
        current += CLASS_END;
        index += 1;
        inClass = false;
      } else if (character === CLASS_END) {
        inClass = false;
      }
    } else if (character === separator) {
      parts.push(current);
      current = '';
    } else {
      inClass = character === CLASS_START;
      current += character;
    }
  }
  return [...parts, current];
}

function characterClass(token: string): readonly string[] {
  const trimmed = token.trim();
  if (trimmed.startsWith(CLASS_START) && trimmed.endsWith(CLASS_END)) {
    return uniq([...trimmed.slice(1, -1)].filter(isPrintable));
  }
  return NAMED_CLASSES[trimmed.toLowerCase()] ?? [];
}

function charactersOf(value: string): readonly string[] {
  return uniq(splitOutsideClasses(value, CLASS_SEPARATOR).flatMap(characterClass));
}

function positiveInteger(value: string): number | null {
  const number = Number(value.trim());
  return Number.isInteger(number) && number > 0 ? number : null;
}

/** Unknown rules and malformed values are skipped, as Apple's parser does: a hint, never a reason to fail. */
export function parsePasswordRules(text: string): IPasswordRules {
  let rules: IPasswordRules = {
    minLength: null,
    maxLength: null,
    maxConsecutive: null,
    required: [],
    allowed: [],
  };
  for (const rule of splitOutsideClasses(text, RULE_END)) {
    const colon = rule.indexOf(NAME_END);
    if (colon < 0) {
      continue;
    }
    const name = rule.slice(0, colon).trim().toLowerCase();
    const value = rule.slice(colon + 1);
    switch (name) {
      case 'minlength':
        rules = { ...rules, minLength: positiveInteger(value) ?? rules.minLength };
        break;
      case 'maxlength':
        rules = { ...rules, maxLength: positiveInteger(value) ?? rules.maxLength };
        break;
      case 'max-consecutive':
        rules = { ...rules, maxConsecutive: positiveInteger(value) ?? rules.maxConsecutive };
        break;
      case 'required': {
        const required = charactersOf(value);
        rules =
          required.length === 0 ? rules : { ...rules, required: [...rules.required, required] };
        break;
      }
      case 'allowed':
        rules = { ...rules, allowed: uniq([...rules.allowed, ...charactersOf(value)]) };
        break;
      default:
        break;
    }
  }
  return rules;
}

/** Every character a password under the rules may use; with no sets given, any printable one. */
export function alphabetOf(rules: IPasswordRules): readonly string[] {
  const alphabet = uniq([...rules.required.flat(), ...rules.allowed]);
  return alphabet.length === 0 ? ASCII_PRINTABLE : alphabet;
}

/** Whether `password` keeps to the rules: what generated passwords are checked against. */
export function meetsPasswordRules(password: string, rules: IPasswordRules): boolean {
  const characters = [...password];
  const alphabet = new Set(alphabetOf(rules));
  let run = 0;
  for (const [index, character] of characters.entries()) {
    run = index > 0 && characters[index - 1] === character ? run + 1 : 1;
    if (!alphabet.has(character) || (!isNil(rules.maxConsecutive) && run > rules.maxConsecutive)) {
      return false;
    }
  }
  return (
    characters.length >= (rules.minLength ?? 0) &&
    characters.length <= (rules.maxLength ?? Number.POSITIVE_INFINITY) &&
    rules.required.every(set => characters.some(character => set.includes(character)))
  );
}
