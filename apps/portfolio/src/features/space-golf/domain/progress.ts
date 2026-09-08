/** What survives between sessions: where the player is and how they did. */
export interface Progress {
  /** The level to play next; levels are numbered from 1 and the number is the seed. */
  readonly levelNumber: number;
  /** Strokes over every completed level. */
  readonly totalStrokes: number;
  /** Fewest strokes per completed level, keyed by level number. */
  readonly bestByLevel: Readonly<Record<string, number>>;
}

const FIRST_LEVEL = 1;

export const INITIAL_PROGRESS: Progress = {
  levelNumber: FIRST_LEVEL,
  totalStrokes: 0,
  bestByLevel: {},
};

/** The progress after holing `levelNumber` in `strokes`: the total grows, the best is kept, the next level is up. */
export function completeLevel(progress: Progress, levelNumber: number, strokes: number): Progress {
  const previousBest = progress.bestByLevel[String(levelNumber)];
  const best = previousBest === undefined ? strokes : Math.min(previousBest, strokes);
  return {
    levelNumber: Math.max(progress.levelNumber, levelNumber + 1),
    totalStrokes: progress.totalStrokes + strokes,
    bestByLevel: { ...progress.bestByLevel, [String(levelNumber)]: best },
  };
}
