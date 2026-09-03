const NICE_STEP_MULTIPLIERS: readonly number[] = [1, 2, 5];
const DECADE = 10;

/** Smallest 1 / 2 / 5 · 10ⁿ value that is at least `minimum`. */
export function chooseNiceStepAtLeast(minimum: number): number {
  if (!(minimum > 0) || !Number.isFinite(minimum)) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(minimum));
  const decade = DECADE ** exponent;

  for (const multiplier of NICE_STEP_MULTIPLIERS) {
    const candidate = multiplier * decade;

    if (candidate >= minimum) {
      return candidate;
    }
  }

  return DECADE * decade;
}

/** Largest 1 / 2 / 5 · 10ⁿ value that is at most `maximum`. */
export function chooseNiceStepAtMost(maximum: number): number {
  if (!(maximum > 0) || !Number.isFinite(maximum)) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(maximum));
  const decade = DECADE ** exponent;

  let result = decade;

  for (const multiplier of NICE_STEP_MULTIPLIERS) {
    const candidate = multiplier * decade;

    if (candidate <= maximum) {
      result = candidate;
    }
  }

  return result;
}
