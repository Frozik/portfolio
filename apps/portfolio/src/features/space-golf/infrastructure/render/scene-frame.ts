import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from '../../domain/ball';
import type { SectorSlice } from '../../domain/course';
import type { Bounds, Level } from '../../domain/level';
import type { BoardViewport } from './board-viewport';

/** What the renderer reads from the game every frame. */
export interface SceneFrame {
  /** The whole course, for what is drawn from the ball's states: spikes, floaters, rods. */
  readonly level: Level;
  /** The course sector by sector, for its static meshes. */
  readonly slices: readonly SectorSlice[];
  /** What of the course is on screen, in metres. */
  readonly visible: Bounds;
  readonly ball: BallState;
  readonly burst: { readonly position: Vector2; readonly elapsedSeconds: number } | undefined;
  /** Where to draw the ball: smoothed between two physics steps. */
  readonly ballPosition: Vector2;
  /** The flying ball's recent positions, oldest first, ending just behind `ballPosition`. */
  readonly trail: readonly Vector2[];
  /** How the world maps onto the canvas this frame, in device pixels: the camera's doing. */
  readonly viewport: BoardViewport;
  readonly preview: readonly Vector2[] | undefined;
  /** Whether the band is stretched enough for a stroke: a ring is drawn round the ball. */
  readonly aimRing: boolean;
}
