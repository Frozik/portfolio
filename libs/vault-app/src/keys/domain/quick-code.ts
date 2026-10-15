import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Milliseconds } from '@frozik/utils/date/types';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

import type { TPatternProblem } from './pattern-code';
import { patternCode } from './pattern-code';

/** How a quick lock is opened: one try, then only the master password does. */
export type TQuickUnlockKind = 'pin' | 'first-four' | 'last-four' | 'pattern';

/** How quick unlock is set up on this device for a vault; sealed with the vault's key. */
export interface IQuickUnlockSetting {
  readonly kind: TQuickUnlockKind;
  /** The canonical code (`pin:1234`, `pattern:0-1-2-5`, `first-four:abcd`). */
  readonly code: string;
  /** How long a quick lock lasts before it becomes full. */
  readonly lifetimeMs: Milliseconds;
  /** A pattern is drawn without its line, for eyes over the shoulder. */
  readonly hideLine: boolean;
  /** Where the platform can keep it (a phone), the code still opens the vault after a restart. */
  readonly keepOverRestart: boolean;
}

/** What the quick lock screen shows: no secret, only the kind of code and how to take it. */
export type TQuickPrompt =
  /** `digits`: the PIN's length, so the pad sends it on the last digit. */
  | { readonly kind: 'pin'; readonly digits: number }
  | { readonly kind: 'pattern'; readonly hideLine: boolean }
  | { readonly kind: 'first-four' | 'last-four' };

const KIND_SEPARATOR = ':';

export function quickPromptOf(setting: IQuickUnlockSetting): TQuickPrompt {
  switch (setting.kind) {
    case 'pin':
      return {
        kind: 'pin',
        digits: setting.code.slice(setting.code.indexOf(KIND_SEPARATOR) + 1).length,
      };
    case 'pattern':
      return { kind: 'pattern', hideLine: setting.hideLine };
    case 'first-four':
    case 'last-four':
      return { kind: setting.kind };
    default:
      return assertNever(setting.kind);
  }
}

const HOUR_MS = 60 * 60 * 1000;
export const DEFAULT_QUICK_LIFETIME_MS = (12 * HOUR_MS) as Milliseconds;
export const QUICK_LIFETIME_CHOICES: readonly Milliseconds[] = [1, 4, 12, 24].map(
  hours => (hours * HOUR_MS) as Milliseconds
);

export const PIN_MIN_DIGITS = 4;
export const PIN_MAX_DIGITS = 8;
/** First or last four characters are offered only for a master password at least this long. */
export const CHARACTERS_MIN_MASTER_LENGTH = 12;
const QUICK_CHARACTERS = 4;
const DIGITS = /^\d+$/;

export type TPinProblem = 'not-digits' | 'too-short' | 'too-long';

export function pinCode(digits: string): TResult<string, TPinProblem> {
  if (!DIGITS.test(digits)) {
    return err('not-digits');
  }
  if (digits.length < PIN_MIN_DIGITS) {
    return err('too-short');
  }
  return digits.length > PIN_MAX_DIGITS ? err('too-long') : ok(`pin:${digits}`);
}

/** Characters as the user sees them: a surrogate pair or a composed accent is one character. */
function charactersOf(password: string): readonly string[] {
  return [...password.normalize('NFC')];
}

export function canUseMasterCharacters(masterPassword: string): boolean {
  return charactersOf(masterPassword).length >= CHARACTERS_MIN_MASTER_LENGTH;
}

/** The first or last four characters of the master password; `null` for one too short to offer it. */
export function masterCharactersCode(
  kind: 'first-four' | 'last-four',
  masterPassword: string
): string | null {
  if (!canUseMasterCharacters(masterPassword)) {
    return null;
  }
  const characters = charactersOf(masterPassword);
  const part =
    kind === 'first-four'
      ? characters.slice(0, QUICK_CHARACTERS)
      : characters.slice(-QUICK_CHARACTERS);
  return `${kind}:${part.join('')}`;
}

export type TQuickEntryProblem = TPinProblem | TPatternProblem;

/** What was typed or drawn at a quick lock, as the canonical code of its kind. */
export function codeOfEntry(
  kind: TQuickUnlockKind,
  entry: string | readonly number[]
): TResult<string, TQuickEntryProblem> {
  if (kind === 'pattern') {
    return typeof entry === 'string' ? err('too-short') : patternCode(entry);
  }
  if (typeof entry !== 'string') {
    return err('not-digits');
  }
  return kind === 'pin' ? pinCode(entry) : ok(typedCharactersCode(kind, entry));
}

/** The four characters typed at a quick lock, in the same canonical form. */
export function typedCharactersCode(kind: 'first-four' | 'last-four', typed: string): string {
  return `${kind}:${charactersOf(typed).join('')}`;
}
