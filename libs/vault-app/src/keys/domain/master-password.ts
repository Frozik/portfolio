/** Below this a weak password is advised to grow; nothing is ever required of it but being there. */
const SUGGESTED_LENGTH = 15;

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

/** What a weak password lacks, to say how to make it stronger. */
export type TPasswordAdvice = 'longer' | 'digits' | 'capitals' | 'symbols';

/** Code points, not UTF-16 units, count: an emoji is one character. */
export function passwordAdvice(password: string): readonly TPasswordAdvice[] {
  const lacks: Readonly<Record<TPasswordAdvice, boolean>> = {
    longer: [...password].length < SUGGESTED_LENGTH,
    digits: !/\p{Nd}/u.test(password),
    capitals: !/\p{Lu}/u.test(password),
    symbols: !/[^\p{L}\p{N}]/u.test(password),
  };
  return PASSWORD_ADVICE.filter(advice => lacks[advice]);
}

const PASSWORD_ADVICE: readonly TPasswordAdvice[] = ['longer', 'digits', 'capitals', 'symbols'];

export type TMasterPasswordProblem = 'no-password' | 'mismatch' | 'not-acknowledged';

/** What still keeps "Create" disabled, the first problem first: any password will do, a weak one is only warned about. */
export function masterPasswordProblem({
  password,
  confirmation,
  acknowledged,
}: {
  readonly password: string;
  readonly confirmation: string;
  readonly acknowledged: boolean;
}): TMasterPasswordProblem | null {
  if (password === '') {
    return 'no-password';
  }
  if (password !== confirmation) {
    return 'mismatch';
  }
  return acknowledged ? null : 'not-acknowledged';
}
