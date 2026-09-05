import { clampAim } from './ballistics';
import { advanceProjectile } from './projectile-flight';
import type { RoundOutcome } from './scoring';
import type { FireOptions } from './simulation/firing';
import { fire } from './simulation/firing';
import type { RoundOptions, RoundState } from './simulation/round-state';
import { createRoundState } from './simulation/round-state';
import { moveWithFuelUnits, raiseShield, retreat, spendBattery } from './simulation/turn-actions';
import { endRoundIfDecided, finishTurn, getActiveTank, openTurn } from './simulation/turn-flow';
import type { RoundWorldContext } from './simulation/world-context';
import { createWorldContext } from './simulation/world-context';
import type { Heightfield } from './terrain/heightfield';
import type {
  AimState,
  ItemId,
  PhysicsOptions,
  PlayerId,
  PlayerInventory,
  Projectile,
  ResolvedWallMode,
  RoundPhase,
  TankState,
  WeaponId,
  WorldEvent,
} from './types';

/**
 * One round of hot-seat artillery: sequential turns, one shot each, resolved to the last tank
 * standing. It owns no timers and no rendering — the application ticks it at a fixed 60 Hz
 * while a shot is in the air and reads the events it returns.
 *
 * The rules live in `simulation/*`, `projectile-flight` and `impact-resolution`; this class owns
 * the state they act on and is the round's public face.
 */
export class ScorchedRound {
  private readonly state: RoundState;
  private readonly context: RoundWorldContext;

  constructor(options: RoundOptions) {
    this.state = createRoundState(options);
    this.context = createWorldContext(this.state);
  }

  get phase(): RoundPhase {
    return this.state.phase;
  }

  get physics(): PhysicsOptions {
    return this.state.options.physics;
  }

  get roundNumber(): number {
    return this.state.options.roundNumber;
  }

  get windUnits(): number {
    return this.state.windUnits;
  }

  get resolvedWallMode(): ResolvedWallMode {
    return this.state.wallMode;
  }

  get field(): Heightfield {
    return this.state.field;
  }

  get tanks(): readonly TankState[] {
    return this.state.tanks;
  }

  get projectiles(): readonly Projectile[] {
    return this.state.projectiles;
  }

  get activePlayerId(): PlayerId | undefined {
    return this.state.phase === 'ended' ? undefined : this.state.turnOrder[this.state.turnIndex];
  }

  get outcome(): RoundOutcome {
    return {
      damages: this.state.damageRecords,
      kills: this.state.killRecords,
      retreatedIds: this.state.retreatedIds,
    };
  }

  start(): readonly WorldEvent[] {
    const { state } = this;
    const events = this.clearEvents();

    events.push({
      type: 'round-started',
      roundNumber: state.options.roundNumber,
      windUnits: state.windUnits,
    });

    // Auto Defense armed these before the first turn — announce them like any raised bubble.
    for (const tank of state.tanks) {
      if (tank.isAlive && tank.shield !== undefined) {
        events.push({ type: 'shield-raised', playerId: tank.playerId, tier: tank.shield.tier });
      }
    }

    if (!endRoundIfDecided(state)) {
      openTurn(state);
    }

    return events;
  }

  getAmmoCount(playerId: PlayerId, weaponId: WeaponId): number {
    return this.state.inventories.getAmmoCount(playerId, weaponId);
  }

  getItemCount(playerId: PlayerId, itemId: ItemId): number {
    return this.state.inventories.getItemCount(playerId, itemId);
  }

  /** What the locker holds after the round's spending — the match banks this between rounds. */
  getRemainingInventory(playerId: PlayerId): PlayerInventory {
    return this.state.inventories.getRemainingInventory(playerId);
  }

  getTank(playerId: PlayerId): TankState | undefined {
    return this.state.tanks.find(tank => tank.playerId === playerId);
  }

  /** [MANUAL §5] The aim is clamped on the way in, so damage always caps the firepower. */
  setAim(aim: AimState): void {
    const tank = getActiveTank(this.state);

    if (tank !== undefined) {
      tank.aim = clampAim(aim, tank.health);
    }
  }

  fire(fireOptions: FireOptions): readonly WorldEvent[] {
    this.clearEvents();

    return fire(this.state, this.context, fireOptions);
  }

  retreat(): readonly WorldEvent[] {
    this.clearEvents();

    return retreat(this.state);
  }

  raiseShield(itemId: ItemId): readonly WorldEvent[] {
    this.clearEvents();

    return raiseShield(this.state, itemId);
  }

  spendBattery(): readonly WorldEvent[] {
    this.clearEvents();

    return spendBattery(this.state);
  }

  moveWithFuelUnits(direction: number): readonly WorldEvent[] {
    this.clearEvents();

    return moveWithFuelUnits(this.state, direction);
  }

  tick(): readonly WorldEvent[] {
    const { state } = this;
    const events = this.clearEvents();

    if (state.phase !== 'flight') {
      return events;
    }

    for (const projectile of [...state.projectiles]) {
      advanceProjectile(this.context, projectile);
    }

    // Nobody may fire over ground that is still coming down: the turn stays in flight
    // until the sand has settled and every falling tank has landed.
    if (state.projectiles.length === 0) {
      if (state.settleTicksRemaining > 0) {
        state.settleTicksRemaining--;
      } else {
        finishTurn(state);
      }
    }

    return events;
  }

  /** The buffer is reused between calls — consumers must read it before driving the round again. */
  private clearEvents(): WorldEvent[] {
    this.state.events.length = 0;

    return this.state.events;
  }
}
