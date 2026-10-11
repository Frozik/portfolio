import type { IPasswordStrength } from '../master-password';

/** Zxcvbn off the main thread; `null` when the estimate was cancelled or the meter failed. */
export interface IStrengthMeter {
  estimate(
    password: string,
    userInputs: readonly string[],
    signal: AbortSignal
  ): Promise<IPasswordStrength | null>;
  dispose(): void;
}
