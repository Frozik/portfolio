import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from '../../domain/ball';
import type { Level } from '../../domain/level';

/** What the renderer reads from the game every frame. */
export interface SceneFrame {
  readonly level: Level;
  readonly ball: BallState;
  readonly burst: { readonly position: Vector2; readonly elapsedSeconds: number } | undefined;
  /** Where to draw the ball: smoothed between two physics steps. */
  readonly ballPosition: Vector2;
  /** The flying ball's recent positions, oldest first, ending just behind `ballPosition`. */
  readonly trail: readonly Vector2[];
  readonly preview: readonly Vector2[] | undefined;
  /** Whether the band is stretched enough for a stroke: a ring is drawn round the ball. */
  readonly aimRing: boolean;
}
