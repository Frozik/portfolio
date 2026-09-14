/** What survives between sessions: where the player is and how they did. */
export interface Progress {
  /** The level being played; levels are numbered from 1 and the number is the seed. */
  readonly levelNumber: number;
  /** Strokes over every completed level. */
  readonly totalStrokes: number;
}

export const FIRST_LEVEL = 1;

export const INITIAL_PROGRESS: Progress = { levelNumber: FIRST_LEVEL, totalStrokes: 0 };

/** The progress after holing the current level in `strokes`: the total grows and the next level is up. */
export function completeLevel(progress: Progress, strokes: number): Progress {
  return { levelNumber: progress.levelNumber + 1, totalStrokes: progress.totalStrokes + strokes };
}
