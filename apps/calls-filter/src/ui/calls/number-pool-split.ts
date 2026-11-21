const DIGIT = /\d/;

/**
 * A number as written, cut after the digits of its pool: `+7 986 510-71-91` with the pool
 * `7986` is `+7 986` and ` 510-71-91`. The cut follows the digits, whatever the separators.
 */
export function splitAtPool(written: string, pool: string): readonly [string, string] {
  let digitsSeen = 0;
  for (const [index, character] of [...written].entries()) {
    if (DIGIT.test(character)) {
      digitsSeen += 1;
      if (digitsSeen === pool.length) {
        return [written.slice(0, index + 1), written.slice(index + 1)];
      }
    }
  }
  return ['', written];
}
