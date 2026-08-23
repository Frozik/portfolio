import type { Terrain } from '../domain/terrain';
import type { Bullet, EnemyTank, PlayerTank, PowerUpDrop } from '../domain/types';
import type { TanksWorld } from '../domain/world';
import type { ITanksWorldView } from './tanks-world-view';

/**
 * The layers hold this ref instead of the world itself, so a campaign restart never tears the
 * renderer down or loses the WebGPU device.
 */
export class TanksWorldRef implements ITanksWorldView {
  constructor(private world: TanksWorld) {}

  get current(): TanksWorld {
    return this.world;
  }

  replace(world: TanksWorld): void {
    this.world = world;
  }

  get terrain(): Terrain {
    return this.world.terrain;
  }

  get players(): readonly PlayerTank[] {
    return this.world.players;
  }

  get enemies(): readonly EnemyTank[] {
    return this.world.enemies;
  }

  get bullets(): readonly Bullet[] {
    return this.world.bullets;
  }

  get powerUp(): PowerUpDrop | undefined {
    return this.world.powerUp;
  }

  get isBaseDestroyed(): boolean {
    return this.world.isBaseDestroyed;
  }

  get ticksSinceStageStart(): number {
    return this.world.ticksSinceStageStart;
  }
}
