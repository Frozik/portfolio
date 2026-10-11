import type { TBytes } from './bytes';

export const KEK_BYTES = 32;
const KIB_PER_MIB = 1024;

export interface IArgon2Params {
  readonly memoryKib: number;
  readonly iterations: number;
  readonly parallelism: number;
}

/** The one slow, WASM-backed step: Argon2id from a password to 32 bytes of key material. */
export interface IKdf {
  argon2id(password: TBytes, salt: TBytes, params: IArgon2Params): Promise<TBytes>;
}

export const ARGON2_DEFAULT: IArgon2Params = {
  memoryKib: 64 * KIB_PER_MIB,
  iterations: 3,
  parallelism: 1,
};

/** Below it a slot is refused: a weakened header must not lower the cost of guessing. */
export const ARGON2_FLOOR: IArgon2Params = {
  memoryKib: 32 * KIB_PER_MIB,
  iterations: 2,
  parallelism: 1,
};

/** Above it a slot is refused: a hostile header must not exhaust a phone's memory. */
export const ARGON2_CEILING: IArgon2Params = {
  memoryKib: 256 * KIB_PER_MIB,
  iterations: 10,
  parallelism: 4,
};

/** PBKDF2 slots are only ever read; the same floor-and-ceiling logic applies. */
export const PBKDF2_MIN_ITERATIONS = 600_000;
export const PBKDF2_MAX_ITERATIONS = 10_000_000;

export function isArgon2WithinBounds({
  memoryKib,
  iterations,
  parallelism,
}: IArgon2Params): boolean {
  return (
    memoryKib >= ARGON2_FLOOR.memoryKib &&
    memoryKib <= ARGON2_CEILING.memoryKib &&
    iterations >= ARGON2_FLOOR.iterations &&
    iterations <= ARGON2_CEILING.iterations &&
    parallelism >= ARGON2_FLOOR.parallelism &&
    parallelism <= ARGON2_CEILING.parallelism
  );
}

export function isPbkdf2WithinBounds(iterations: number): boolean {
  return iterations >= PBKDF2_MIN_ITERATIONS && iterations <= PBKDF2_MAX_ITERATIONS;
}
