/**
 * How the view keeps the ball: at the edge only — standing still until the
 * ball nears a side of the screen, the way that never makes a screen swim;
 * centred whenever it comes to rest; or centred always, the flight and all.
 */
export type Following = 'edge' | 'rest' | 'always';

/** The way of following the player last chose: it outlives the world and the reload. */
export interface FollowingStorage {
  read(): Following;
  write(following: Following): void;
}
