import type { Milliseconds } from '@frozik/utils/date/types';

import type { TBytes } from './bytes';
import type { IArgon2Params, IKdf } from './kdf-port';
import { ARGON2_DEFAULT, ARGON2_FLOOR } from './kdf-port';

const UNLOCK_BUDGET_MS = 1000;
const CALIBRATION_PASSWORD = new Uint8Array(16);
const CALIBRATION_SALT = new Uint8Array(16);

/** Strongest first; the floor is the last resort and is still accepted on every device. */
const CANDIDATES: readonly IArgon2Params[] = [
  ARGON2_DEFAULT,
  { ...ARGON2_DEFAULT, iterations: ARGON2_FLOOR.iterations },
  ARGON2_FLOOR,
];

function relativeCost({ memoryKib, iterations }: IArgon2Params): number {
  return (memoryKib * iterations) / (ARGON2_DEFAULT.memoryKib * ARGON2_DEFAULT.iterations);
}

/**
 * The password slot is shared by every device of the vault,
 * so calibration only ever lowers the cost: a laptop raising it would make
 * the same vault take seconds to open on a phone. Argon2 time grows linearly
 * with memory × passes, so one measurement of the default predicts the rest.
 */
export function chooseArgon2Params(defaultTakes: Milliseconds): IArgon2Params {
  return (
    CANDIDATES.find(candidate => defaultTakes * relativeCost(candidate) <= UNLOCK_BUDGET_MS) ??
    ARGON2_FLOOR
  );
}

export async function calibrateArgon2(kdf: IKdf, now: () => Milliseconds): Promise<IArgon2Params> {
  const startedAt = now();
  const output: TBytes = await kdf.argon2id(CALIBRATION_PASSWORD, CALIBRATION_SALT, ARGON2_DEFAULT);
  output.fill(0);
  return chooseArgon2Params((now() - startedAt) as Milliseconds);
}
