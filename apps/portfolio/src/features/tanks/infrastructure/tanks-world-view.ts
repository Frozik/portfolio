import type { Terrain } from '../domain/terrain';
import type { Bullet, EnemyTank, PlayerTank, PowerUpDrop } from '../domain/types';

/** The read-only window the render layers get onto the simulation; `TanksWorld` satisfies it as-is. */
export interface ITanksWorldView {
  readonly terrain: Terrain;
  readonly players: readonly PlayerTank[];
  readonly enemies: readonly EnemyTank[];
  readonly bullets: readonly Bullet[];
  readonly powerUp: PowerUpDrop | undefined;
  readonly isBaseDestroyed: boolean;
  readonly ticksSinceStageStart: number;
}
