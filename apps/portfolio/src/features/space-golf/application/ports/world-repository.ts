import type { Play } from '../../domain/course';

/** The format of a saved world; a world saved under another version is discarded, not migrated. */
export const SAVED_WORLD_VERSION = 3;

/** Everything a reload needs to put the player back on the very spot. */
export interface SavedWorld {
  readonly version: number;
  readonly play: Play;
  readonly holes: number;
  readonly totalStrokes: number;
  readonly strokesSinceHole: number;
}

export interface WorldRepository {
  load(): Promise<SavedWorld | undefined>;
  save(world: SavedWorld): Promise<void>;
  clear(): Promise<void>;
}
