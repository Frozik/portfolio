import type { Level } from '../../domain/level';

/** Where levels come from: a worker in the browser, the generator itself in tests. */
export interface LevelSource {
  generate(seed: number): Promise<Level>;
  dispose(): void;
}
