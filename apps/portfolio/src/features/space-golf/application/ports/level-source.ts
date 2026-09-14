import type { Level } from '../../domain/level';

/** Where levels come from: the generator in the app, a hand-built arena in tests. */
export type LevelSource = (seed: number) => Level;
