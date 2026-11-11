import type { IPasswordStrength } from '../../../keys/domain/master-password';

/** Zxcvbn off the main thread; `null` when the estimate was cancelled or the meter failed. */
export interface IStrengthMeter {
  /** The dictionaries and rules it scores with: the vault keeps its scores apart from another meter's. */
  readonly id: string;
  estimate(
    password: string,
    userInputs: readonly string[],
    signal: AbortSignal
  ): Promise<IPasswordStrength | null>;
  dispose(): void;
}
