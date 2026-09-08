import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from '../../domain/ball';
import type { Level } from '../../domain/level';

/** What the renderer reads from the game every frame. */
export interface SceneFrame {
  readonly level: Level;
  readonly ball: BallState;
  readonly burst: { readonly position: Vector2; readonly elapsedSeconds: number } | undefined;
  /** Which stroke's spike states to draw: the coming one while aiming, the current one in flight. */
  readonly displayedStroke: number;
  readonly preview: readonly Vector2[] | undefined;
  /** Whether the band is held: a ring is drawn round the ball. */
  readonly aimRing: boolean;
}
