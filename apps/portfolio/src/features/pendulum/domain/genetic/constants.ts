// Number of individuals in a genetic population. The generations table renders
// one player column per population member, so this single source of truth keeps
// `createFitnessCompetition` (the population it breeds) and `GenerationsList`
// (the columns it builds) from drifting apart.
export const POPULATION_SIZE = 30;

/** A robot still scoring below this per millisecond after `HOPELESS_AFTER` has not lifted the bob and is stopped early. */
export const HOPELESS_SCORE_PER_MS = 0.02;
export const HOPELESS_AFTER = 5000;

/** Per-millisecond score, summed over a robot's episodes, of one that balanced for most of both. */
export const SEASONED_SCORE_PER_MS = 2.5;
/** The best score per millisecond the reward can pay over both episodes: balanced, centred, still. */
export const MAX_SCORE_PER_MS = 4;
