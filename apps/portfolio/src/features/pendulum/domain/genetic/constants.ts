// Number of individuals in a genetic population. The generations table renders
// one player column per population member, so this single source of truth keeps
// `createFitnessCompetition` (the population it breeds) and `GenerationsList`
// (the columns it builds) from drifting apart.
export const POPULATION_SIZE = 30;

export const HALT_PLAYER_SCORE_PER_MS = -4;
export const LOW_PLAYER_SCORE_PER_MS = -2;
export const MEDIUM_SCORE_PER_MS = 10;
export const HIGH_SCORE_PER_MS = 50;
