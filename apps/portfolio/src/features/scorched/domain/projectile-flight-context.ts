import type { Vector2 } from '@frozik/utils/math/vector2';
import type { BallisticsEnvironment } from './ballistics';
import type { ShieldAbsorption } from './items/behaviors';
import type { Heightfield } from './terrain/heightfield';
import type {
  GuidanceKind,
  MagDeflectorState,
  PhysicsOptions,
  PlayerId,
  Projectile,
  ProjectileEndReason,
  ProjectileState,
  TankState,
  WorldEvent,
} from './types';

/**
 * The slice of the round a shell in the air is allowed to touch. Everything that outlives the
 * flight — the projectile list, the events, the damage ledger — is reached through here rather
 * than owned, so the flight rules stay a pure function of the world they are handed.
 */
export interface ProjectileFlightContext {
  getField(): Heightfield;
  setField(field: Heightfield): void;
  getTanks(): readonly TankState[];
  getPhysics(): PhysicsOptions;
  getMagDeflectors(): readonly MagDeflectorState[];
  setMagDeflectors(deflectors: readonly MagDeflectorState[]): void;
  createEnvironment(guidance: GuidanceKind | undefined): BallisticsEnvironment;
  pushEvent(event: WorldEvent): void;
  getTank(playerId: PlayerId): TankState | undefined;
  spawnWarhead(
    parent: Projectile,
    state: ProjectileState,
    blastRadiusWu: number,
    stageIndex: number
  ): Projectile;
  removeProjectile(projectile: Projectile): void;
  endProjectile(projectile: Projectile, position: Vector2, reason: ProjectileEndReason): void;
  detonate(projectile: Projectile, impact: Vector2, isDirectTankHit: boolean): void;
  applyShieldAbsorption(tank: TankState, absorption: ShieldAbsorption): void;
}
