import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from '../../domain/ball';
import type { Level } from '../../domain/level';

/** What the renderer reads from the game every frame. */
export interface SceneFrame {
  readonly level: Level;
  readonly ball: BallState;
  readonly burst: { readonly position: Vector2; readonly elapsedSeconds: number } | undefined;
  readonly preview: readonly Vector2[] | undefined;
  /** Whether the band is stretched enough for a stroke: a ring is drawn round the ball. */
  readonly aimRing: boolean;
}
