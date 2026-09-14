import alea from 'alea';

/** A seeded source of randomness: the same seed always yields the same level. */
export interface Random {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
}

export function createRandom(seed: number): Random {
  const generator = alea(String(seed));
  return {
    next: () => generator(),
    int: (min, max) => min + Math.floor(generator() * (max - min + 1)),
    chance: probability => generator() < probability,
    pick: items => items[Math.floor(generator() * items.length)],
  };
}
