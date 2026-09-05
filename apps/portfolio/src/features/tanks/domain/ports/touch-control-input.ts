import type { Direction } from '../types';

/** What the touch overlay writes into; the world reads the result as ordinary player inputs. */
export interface ITouchControlInput {
  setDirection(direction: Direction | undefined): void;
  setFire(isPressed: boolean): void;
  /** Drops every held zone — used when the overlay unmounts or the run restarts. */
  release(): void;
}
