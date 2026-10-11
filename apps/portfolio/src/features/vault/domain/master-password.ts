/** Hard minimum; 15+ is only suggested, and no composition rules apply. */
export const MASTER_PASSWORD_MIN_LENGTH = 12;
export const MASTER_PASSWORD_SUGGESTED_LENGTH = 15;

/** zxcvbn's 0–4; below this a password is called weak (a warning, never a refusal). */
const STRONG_ENOUGH_SCORE = 3;

type TStrengthScore = 0 | 1 | 2 | 3 | 4;

/** What the meter says; the password itself never comes back from the Worker. */
export interface IPasswordStrength {
  readonly score: TStrengthScore;
  /** How long an offline attack on a slow hash takes, in words of the page language. */
  readonly offlineCrackTime: string;
  readonly warning: string | null;
  readonly suggestions: readonly string[];
}

export function isWeak(strength: IPasswordStrength): boolean {
  return strength.score < STRONG_ENOUGH_SCORE;
}

export type TMasterPasswordProblem = 'too-short' | 'mismatch' | 'not-acknowledged';

/** What still keeps "Create" disabled, the first problem first. Code points, not UTF-16 units, count. */
export function masterPasswordProblem({
  password,
  confirmation,
  acknowledged,
}: {
  readonly password: string;
  readonly confirmation: string;
  readonly acknowledged: boolean;
}): TMasterPasswordProblem | null {
  if ([...password].length < MASTER_PASSWORD_MIN_LENGTH) {
    return 'too-short';
  }
  if (password !== confirmation) {
    return 'mismatch';
  }
  return acknowledged ? null : 'not-acknowledged';
}
