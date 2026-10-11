import {
  ARGON2_CEILING,
  ARGON2_DEFAULT,
  ARGON2_FLOOR,
  isArgon2WithinBounds,
  isPbkdf2WithinBounds,
} from './kdf-port';

describe('KDF parameter bounds', () => {
  it.each([
    ['the default', ARGON2_DEFAULT, true],
    ['the floor', ARGON2_FLOOR, true],
    ['the ceiling', ARGON2_CEILING, true],
    [
      'less memory than the floor',
      { ...ARGON2_FLOOR, memoryKib: ARGON2_FLOOR.memoryKib - 1 },
      false,
    ],
    ['fewer passes than the floor', { ...ARGON2_DEFAULT, iterations: 1 }, false],
    [
      'more memory than the ceiling',
      { ...ARGON2_DEFAULT, memoryKib: ARGON2_CEILING.memoryKib + 1 },
      false,
    ],
    ['more passes than the ceiling', { ...ARGON2_DEFAULT, iterations: 11 }, false],
    ['more lanes than the ceiling', { ...ARGON2_DEFAULT, parallelism: 5 }, false],
  ])('accepts Argon2id slots only within bounds: %s', (_name, params, accepted) => {
    expect(isArgon2WithinBounds(params)).toBe(accepted);
  });

  it.each([
    [599_999, false],
    [600_000, true],
    [10_000_000, true],
    [10_000_001, false],
  ])('reads a PBKDF2 slot of %i iterations: %s', (iterations, accepted) => {
    expect(isPbkdf2WithinBounds(iterations)).toBe(accepted);
  });
});
