const TRUNCATION_DEVIATIONS = 2;

/** Box–Muller; the second deviate of the pair is discarded. */
export function standardNormal(): number {
  const uniform = 1 - Math.random();

  return Math.sqrt(-2 * Math.log(uniform)) * Math.cos(2 * Math.PI * Math.random());
}

/**
 * Normal noise with deviates beyond two standard deviations redrawn — the
 * shape tf.js `truncatedNormal` produced, kept so evolution starts from the
 * same weight distribution it was tuned against.
 */
export function truncatedNormal(standardDeviation: number): number {
  let deviate = standardNormal();

  while (Math.abs(deviate) > TRUNCATION_DEVIATIONS) {
    deviate = standardNormal();
  }

  return deviate * standardDeviation;
}
