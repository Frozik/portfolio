import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil, random } from 'lodash-es';
import { refineAimForWind } from './ai/aim-solver';
import type { BallisticsEnvironment } from './ballistics';
import {
  clampAim,
  createEnvironment,
  getLaunchOrigin,
  getLaunchVelocity,
  getMaxPower,
  hasCrossedApex,
  isPerShotWallMode,
  resolveWallMode,
  rollWind,
  stepProjectile,
  traceTerrainImpact,
} from './ballistics';
import {
  BATTERY_HEALTH_BONUS,
  COLLAPSE_GRAVITY_WU_PER_TICK_SQUARED,
  COLLAPSE_SETTLE_MARGIN_TICKS,
  DEFAULT_ROLLER_SPEED_WU_PER_TICK,
  FIELD_HEIGHT_WU,
  LASER_DAMAGE,
  LIQUID_DIRT_MAX_HALF_SPAN_COLUMNS,
  LIQUID_DIRT_POUR_INTERVAL_TICKS,
  LIQUID_DIRT_POUR_PORTIONS,
  MAX_FLIGHT_TICKS,
  MIN_TANK_HEALTH,
  MIN_TANKS_ALIVE_TO_CONTINUE,
  ROLLER_MAX_CLIMB_WU_PER_COLUMN,
  ROLLER_MAX_TRAVEL_COLUMNS,
  ROLLER_SHIELD_STANDOFF_WU,
  ROLLER_SPEED_WU_PER_TICK,
  TANK_CENTER_OFFSET_WU,
  TANK_HALF_WIDTH_WU,
  TANK_HEIGHT_WU,
} from './constants';
import type { ShieldAbsorption } from './items';
import {
  absorbWithShield,
  applyBatteries,
  applyGuidance,
  applyMagDeflection,
  createMagDeflector,
  createShield,
  getGuidedWindAcceleration,
  isLaserBlockedBy,
  isPermanentItem,
  moveWithFuel,
  resolveShieldInteraction,
  selectBestShieldItem,
} from './items';
import type { DamageRecord, KillRecord, RoundOutcome } from './scoring';
import type { Heightfield } from './terrain/heightfield';
import {
  carveWedge,
  computeTankFalls,
  depositCircle,
  depositWedge,
  fillHollows,
  getColumnIndexAt,
  getDownhillStep,
  getSurfaceHeight,
} from './terrain/heightfield';
import type {
  AimState,
  DamageCause,
  GuidanceKind,
  ItemCounts,
  ItemId,
  MagDeflectorState,
  PhysicsOptions,
  PlayerId,
  PlayerInventory,
  PlayOrder,
  PouringState,
  Projectile,
  ProjectileEndReason,
  ProjectileState,
  ResolvedWallMode,
  RollingState,
  RoundPhase,
  TankState,
  WeaponCounts,
  WeaponId,
  WorldEvent,
} from './types';
import type { ImpactEffect, TankColumnView } from './weapons/behaviors';
import {
  computeLaserHits,
  computeNapalmDamage,
  getLaserBeamEnd,
  getPlasmaRadius,
  resolveImpact,
  splitAtApex,
} from './weapons/behaviors';
import type { WeaponDefinition } from './weapons/catalog';
import { getWeapon } from './weapons/catalog';
import { applyBlastToTerrain, computeBlastDamage, getBlastPeakDamage } from './weapons/explosions';

export interface RoundPlayerSetup {
  readonly id: PlayerId;
  readonly columnIndex: number;
  readonly health: number;
  readonly inventory: PlayerInventory;
  /** [MANUAL §7] The bubble Auto Defense (or the player) armed before the round opened. */
  readonly armedShieldItemId?: ItemId;
}

export interface RoundOptions {
  readonly roundNumber: number;
  readonly players: readonly RoundPlayerSetup[];
  readonly field: Heightfield;
  readonly physics: PhysicsOptions;
  readonly playOrder: PlayOrder;
}

export interface FireOptions {
  readonly weaponId: WeaponId;
  readonly guidance?: GuidanceKind;
  readonly guidanceTarget?: Vector2;
  readonly useContactTrigger?: boolean;
  readonly plasmaBatteries?: number;
}

interface MutableInventory {
  readonly weapons: Map<WeaponId, number>;
  readonly items: Map<ItemId, number>;
}

/** [MANUAL §6] Dirt Charge is Riot Charge in reverse: it piles a wedge over the firing tank. */
const SELF_CENTERED_FAMILIES: readonly WeaponDefinition['family'][] = [
  'riot-charge',
  'plasma',
  'dirt-charge',
];

/** The Super Mag's field replaces a plain deflector when a tank happens to own both. */
const MAG_DEFLECTOR_PREFERENCE: readonly ItemId[] = ['super-mag', 'mag-deflector'];

/** One press of a fuel key drives one column, so a held key drives at the key's repeat rate. */
const FUEL_MOVE_COLUMNS_PER_REQUEST = 1;
/** A single battery is spent per use, so the player watches the bar climb ten at a time. */
const BATTERIES_PER_USE = 1;

function toMutableInventory(inventory: PlayerInventory): MutableInventory {
  return {
    weapons: new Map(Object.entries(inventory.weapons) as [WeaponId, number][]),
    items: new Map(Object.entries(inventory.items) as [ItemId, number][]),
  };
}

function isInsideTankBox(tank: TankState, point: Vector2): boolean {
  return (
    Math.abs(point.x - (tank.columnIndex + 0.5)) <= TANK_HALF_WIDTH_WU &&
    point.y >= tank.positionY &&
    point.y <= tank.positionY + TANK_HEIGHT_WU
  );
}

function shuffle<Item>(items: readonly Item[]): Item[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = random(index);

    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

/**
 * One round of hot-seat artillery: sequential turns, one shot each, resolved to the last tank
 * standing. It owns no timers and no rendering — the application ticks it at a fixed 60 Hz
 * while a shot is in the air and reads the events it returns.
 */
export class ScorchedRound {
  /** Reused between calls — consumers must read it before driving the round again. */
  private readonly events: WorldEvent[] = [];
  private readonly options: RoundOptions;
  private readonly tankStates: TankState[];
  private readonly inventories = new Map<PlayerId, MutableInventory>();
  private readonly damageRecords: DamageRecord[] = [];
  private readonly killRecords: KillRecord[] = [];
  private readonly retreatedIds: PlayerId[] = [];
  private fieldState: Heightfield;
  private projectileList: Projectile[] = [];
  private magDeflectors: MagDeflectorState[] = [];
  private turnOrder: PlayerId[];
  private turnIndex = 0;
  private settleTicksRemaining = 0;
  private phaseValue: RoundPhase = 'aiming';
  private windValue: number;
  private wallMode: ResolvedWallMode;
  private nextProjectileId = 1;
  private nextShotId = 1;

  constructor(options: RoundOptions) {
    this.options = options;
    this.fieldState = options.field;
    this.windValue = rollWind(options.physics.maxWind);
    this.wallMode = resolveWallMode(options.physics.wallMode);
    this.tankStates = options.players.map(player => ({
      playerId: player.id,
      columnIndex: player.columnIndex,
      positionY: getSurfaceHeight(options.field, player.columnIndex),
      health: player.health,
      aim: { facing: 'right', elevationDegrees: 45, power: 0 },
      shield:
        player.armedShieldItemId === undefined ? undefined : createShield(player.armedShieldItemId),
      fuelCreditWu: 0,
      isAlive: player.health > MIN_TANK_HEALTH,
      hasRetreated: false,
    }));

    for (const player of options.players) {
      this.inventories.set(player.id, toMutableInventory(player.inventory));
    }

    const aliveIds = this.tankStates.filter(tank => tank.isAlive).map(tank => tank.playerId);

    this.turnOrder = options.playOrder === 'random' ? shuffle(aliveIds) : aliveIds;
    this.magDeflectors = this.createMagDeflectors();
  }

  get phase(): RoundPhase {
    return this.phaseValue;
  }

  get physics(): PhysicsOptions {
    return this.options.physics;
  }

  get roundNumber(): number {
    return this.options.roundNumber;
  }

  get windUnits(): number {
    return this.windValue;
  }

  get resolvedWallMode(): ResolvedWallMode {
    return this.wallMode;
  }

  get field(): Heightfield {
    return this.fieldState;
  }

  get tanks(): readonly TankState[] {
    return this.tankStates;
  }

  get projectiles(): readonly Projectile[] {
    return this.projectileList;
  }

  get activePlayerId(): PlayerId | undefined {
    return this.phaseValue === 'ended' ? undefined : this.turnOrder[this.turnIndex];
  }

  get outcome(): RoundOutcome {
    return {
      damages: this.damageRecords,
      kills: this.killRecords,
      retreatedIds: this.retreatedIds,
    };
  }

  start(): readonly WorldEvent[] {
    this.events.length = 0;
    this.events.push({
      type: 'round-started',
      roundNumber: this.options.roundNumber,
      windUnits: this.windValue,
    });

    // Auto Defense armed these before the first turn — announce them like any raised bubble.
    for (const tank of this.tankStates) {
      if (tank.isAlive && tank.shield !== undefined) {
        this.events.push({
          type: 'shield-raised',
          playerId: tank.playerId,
          tier: tank.shield.tier,
        });
      }
    }

    if (this.endRoundIfDecided()) {
      return this.events;
    }

    this.openTurn();

    return this.events;
  }

  getAmmoCount(playerId: PlayerId, weaponId: WeaponId): number {
    return this.inventories.get(playerId)?.weapons.get(weaponId) ?? 0;
  }

  getItemCount(playerId: PlayerId, itemId: ItemId): number {
    return this.inventories.get(playerId)?.items.get(itemId) ?? 0;
  }

  /** What the locker holds after the round's spending — the match banks this between rounds. */
  getRemainingInventory(playerId: PlayerId): PlayerInventory {
    const inventory = this.inventories.get(playerId);

    return {
      weapons: Object.fromEntries(inventory?.weapons ?? []) as WeaponCounts,
      items: Object.fromEntries(inventory?.items ?? []) as ItemCounts,
    };
  }

  getTank(playerId: PlayerId): TankState | undefined {
    return this.tankStates.find(tank => tank.playerId === playerId);
  }

  /** [MANUAL §5] The aim is clamped on the way in, so damage always caps the firepower. */
  setAim(aim: AimState): void {
    const tank = this.getActiveTank();

    if (tank === undefined) {
      return;
    }

    tank.aim = clampAim(aim, tank.health);
  }

  fire(fireOptions: FireOptions): readonly WorldEvent[] {
    this.events.length = 0;

    const tank = this.getActiveTank();

    if (tank === undefined || this.phaseValue !== 'aiming') {
      return this.events;
    }

    const weapon = getWeapon(fireOptions.weaponId);

    if (!this.consumeAmmo(tank.playerId, weapon)) {
      return this.events;
    }

    if (isPerShotWallMode(this.options.physics.wallMode)) {
      this.wallMode = resolveWallMode(this.options.physics.wallMode);
    }

    const shotId = this.nextShotId++;
    const hasContactTrigger = this.consumeContactTrigger(tank, fireOptions);

    this.phaseValue = 'flight';

    if (weapon.family === 'laser') {
      this.fireLaser(tank);
      this.finishTurn();

      return this.events;
    }

    if (SELF_CENTERED_FAMILIES.includes(weapon.family)) {
      this.fireSelfCentered(tank, weapon, fireOptions, shotId, hasContactTrigger);
      this.finishTurn();

      return this.events;
    }

    const guidance = this.consumeGuidance(tank, fireOptions.guidance);

    if (guidance === 'lazy-boy') {
      this.applyLazyBoyAim(tank, fireOptions.guidanceTarget);
    }

    this.launchProjectile(
      tank,
      weapon,
      // Lazy Boy has already aimed the tank; the shot itself flies ordinary ballistics.
      { ...fireOptions, guidance: guidance === 'lazy-boy' ? undefined : guidance },
      shotId,
      hasContactTrigger
    );

    return this.events;
  }

  /** A permanent device corrects every shot it is installed for; anything else is spent per use. */
  private consumeGuidance(
    tank: TankState,
    guidance: GuidanceKind | undefined
  ): GuidanceKind | undefined {
    if (guidance === undefined) {
      return undefined;
    }

    if (isPermanentItem(guidance)) {
      return this.getItemCount(tank.playerId, guidance) > 0 ? guidance : undefined;
    }

    return this.consumeItem(tank.playerId, guidance) > 0 ? guidance : undefined;
  }

  /** [MANUAL §7] Lazy Boy aims the tank by itself — wind-aware — before the trigger drops. */
  private applyLazyBoyAim(tank: TankState, target: Vector2 | undefined): void {
    if (target === undefined) {
      return;
    }

    const solved = refineAimForWind(
      this.getTankCenter(tank),
      target,
      this.createEnvironment(undefined),
      this.fieldState,
      getMaxPower(tank.health)
    );

    if (solved !== undefined) {
      tank.aim = clampAim(solved, tank.health);
    }
  }

  /** [MANUAL §8] Retreating forfeits the round's points but denies the killer their bounty. */
  retreat(): readonly WorldEvent[] {
    this.events.length = 0;

    const tank = this.getActiveTank();

    if (tank === undefined || this.phaseValue !== 'aiming') {
      return this.events;
    }

    tank.hasRetreated = true;
    tank.isAlive = false;
    this.retreatedIds.push(tank.playerId);
    this.events.push({
      type: 'tank-retreated',
      playerId: tank.playerId,
      position: this.getTankCenter(tank),
    });
    this.finishTurn();

    return this.events;
  }

  /**
   * [MANUAL §7] A bubble raised in the field, out of the tank's own locker, on its own turn — the
   * manual's alternative to paying Auto Defense to do it. Raising a second one replaces whatever
   * is standing rather than stacking with it, so the tier that goes up last is the tier that holds.
   */
  raiseShield(itemId: ItemId): readonly WorldEvent[] {
    this.events.length = 0;

    const tank = this.getActiveTank();

    if (tank === undefined || this.phaseValue !== 'aiming') {
      return this.events;
    }

    const shield = createShield(itemId);

    if (shield === undefined || this.consumeItem(tank.playerId, itemId) <= 0) {
      return this.events;
    }

    tank.shield = shield;
    this.events.push({ type: 'shield-raised', playerId: tank.playerId, tier: shield.tier });

    return this.events;
  }

  /**
   * [MANUAL §7] A battery spent in the field. One press is one battery, and a tank already at the
   * cap spends nothing — the manual is explicit that a battery is never wasted.
   */
  spendBattery(): readonly WorldEvent[] {
    this.events.length = 0;

    const tank = this.getActiveTank();

    if (tank === undefined || this.phaseValue !== 'aiming') {
      return this.events;
    }

    const available = this.getItemCount(tank.playerId, 'battery');
    const use = applyBatteries(tank.health, Math.min(BATTERIES_PER_USE, available));

    if (use.consumed <= 0) {
      return this.events;
    }

    this.consumeItem(tank.playerId, 'battery', use.consumed);
    tank.health = use.health;
    this.events.push({
      type: 'tank-repaired',
      playerId: tank.playerId,
      amount: use.consumed * BATTERY_HEALTH_BONUS,
      health: tank.health,
    });

    return this.events;
  }

  /**
   * [MANUAL §7] Driving on fuel: one request moves the tank a column towards `direction`, uphill
   * costing extra and a slope the tracks cannot hold turning the drive into a slide.
   */
  moveWithFuelUnits(direction: number): readonly WorldEvent[] {
    this.events.length = 0;

    const tank = this.getActiveTank();

    if (tank === undefined || this.phaseValue !== 'aiming' || Math.sign(direction) === 0) {
      return this.events;
    }

    const available = this.getItemCount(tank.playerId, 'fuel') + tank.fuelCreditWu;

    if (available <= 0) {
      return this.events;
    }

    const move = moveWithFuel(
      this.fieldState,
      tank.columnIndex,
      direction,
      available,
      FUEL_MOVE_COLUMNS_PER_REQUEST
    );

    if (move.columnIndex === tank.columnIndex) {
      return this.events;
    }

    // Whole units leave the locker; the paid-but-unburnt fraction stays as credit for the next
    // column, so a long uphill drive costs its true price rather than a rounded-up unit per step.
    const owedWu = move.fuelSpent - tank.fuelCreditWu;
    const chargedUnits = Math.max(0, Math.ceil(owedWu));

    this.consumeItem(tank.playerId, 'fuel', chargedUnits);
    tank.fuelCreditWu = chargedUnits - owedWu;
    tank.columnIndex = move.columnIndex;
    tank.positionY = getSurfaceHeight(this.fieldState, move.columnIndex);
    this.events.push({
      type: 'tank-moved',
      playerId: tank.playerId,
      columnIndex: tank.columnIndex,
      positionY: tank.positionY,
    });

    return this.events;
  }

  tick(): readonly WorldEvent[] {
    this.events.length = 0;

    if (this.phaseValue !== 'flight') {
      return this.events;
    }

    for (const projectile of [...this.projectileList]) {
      this.advanceProjectile(projectile);
    }

    // [§5] Nobody may fire over ground that is still coming down: the turn stays in flight
    // until the sand has settled and every falling tank has landed.
    if (this.projectileList.length === 0) {
      if (this.settleTicksRemaining > 0) {
        this.settleTicksRemaining--;
      } else {
        this.finishTurn();
      }
    }

    return this.events;
  }

  private getActiveTank(): TankState | undefined {
    const playerId = this.turnOrder[this.turnIndex];

    return this.tankStates.find(tank => tank.playerId === playerId && tank.isAlive);
  }

  private getTankCenter(tank: TankState): Vector2 {
    return { x: tank.columnIndex + 0.5, y: tank.positionY + TANK_CENTER_OFFSET_WU };
  }

  private getTankViews(): readonly TankColumnView[] {
    return this.tankStates
      .filter(tank => tank.isAlive)
      .map(tank => ({
        playerId: tank.playerId,
        columnIndex: tank.columnIndex,
        positionY: tank.positionY,
        hasShield: tank.shield !== undefined,
      }));
  }

  private createEnvironment(guidance: GuidanceKind | undefined): BallisticsEnvironment {
    const environment = createEnvironment(
      this.options.physics,
      this.windValue,
      this.wallMode,
      this.fieldState.length
    );

    return {
      ...environment,
      windAccelerationWuPerTickSquared: getGuidedWindAcceleration(
        guidance,
        environment.windAccelerationWuPerTickSquared
      ),
    };
  }

  private createMagDeflectors(): MagDeflectorState[] {
    return this.tankStates.flatMap(tank => {
      const itemId = MAG_DEFLECTOR_PREFERENCE.find(
        candidate => (this.inventories.get(tank.playerId)?.items.get(candidate) ?? 0) > 0
      );

      return itemId === undefined
        ? []
        : [createMagDeflector(itemId, tank.playerId, this.getTankCenter(tank))];
    });
  }

  private consumeAmmo(playerId: PlayerId, weapon: WeaponDefinition): boolean {
    if (weapon.isUnlimited) {
      return true;
    }

    const inventory = this.inventories.get(playerId);
    const count = inventory?.weapons.get(weapon.id) ?? 0;

    if (inventory === undefined || count <= 0) {
      return false;
    }

    inventory.weapons.set(weapon.id, count - 1);

    return true;
  }

  private consumeItem(playerId: PlayerId, itemId: ItemId, amount = 1): number {
    const inventory = this.inventories.get(playerId);
    const available = inventory?.items.get(itemId) ?? 0;
    const consumed = Math.min(available, amount);

    if (inventory !== undefined && consumed > 0) {
      inventory.items.set(itemId, available - consumed);
    }

    return consumed;
  }

  private consumeContactTrigger(tank: TankState, fireOptions: FireOptions): boolean {
    if (fireOptions.useContactTrigger !== true) {
      return false;
    }

    return this.consumeItem(tank.playerId, 'contact-trigger') > 0;
  }

  private createProjectile(
    tank: TankState,
    weapon: WeaponDefinition,
    fireOptions: FireOptions,
    shotId: number,
    hasContactTrigger: boolean,
    state: ProjectileState,
    blastRadiusWu: number,
    stageIndex: number
  ): Projectile {
    return {
      id: this.nextProjectileId++,
      ownerId: tank.playerId,
      weaponId: weapon.id,
      shotId,
      hasContactTrigger,
      guidance: fireOptions.guidance,
      guidanceTarget: fireOptions.guidanceTarget,
      blastRadiusWu,
      stageIndex,
      state,
      rolling: undefined,
      pouring: undefined,
      hasPassedApex: false,
      hasClearedOwner: false,
      isMagDeflected: false,
      ticksAlive: 0,
    };
  }

  private launchProjectile(
    tank: TankState,
    weapon: WeaponDefinition,
    fireOptions: FireOptions,
    shotId: number,
    hasContactTrigger: boolean
  ): void {
    const state: ProjectileState = {
      position: getLaunchOrigin(tank.columnIndex + 0.5, tank.positionY, tank.aim),
      velocity: getLaunchVelocity(tank.aim),
    };
    const projectile = this.createProjectile(
      tank,
      weapon,
      fireOptions,
      shotId,
      hasContactTrigger,
      state,
      weapon.hopRadiiWu[0] ?? weapon.blastRadiusWu,
      0
    );

    this.projectileList.push(projectile);
    this.events.push({
      type: 'projectile-launched',
      projectileId: projectile.id,
      ownerId: tank.playerId,
      weaponId: weapon.id,
      position: state.position,
      velocity: state.velocity,
    });
  }

  /** [MANUAL §6] Riot charges and plasma go off at the tank rather than flying anywhere. */
  private fireSelfCentered(
    tank: TankState,
    weapon: WeaponDefinition,
    fireOptions: FireOptions,
    shotId: number,
    hasContactTrigger: boolean
  ): void {
    const batteries =
      weapon.family === 'plasma'
        ? this.consumeItem(tank.playerId, 'battery', fireOptions.plasmaBatteries ?? 1)
        : 0;
    const blastRadiusWu =
      weapon.family === 'plasma' ? getPlasmaRadius(batteries) : weapon.blastRadiusWu;
    const projectile = this.createProjectile(
      tank,
      weapon,
      fireOptions,
      shotId,
      hasContactTrigger,
      { position: this.getTankCenter(tank), velocity: { x: 0, y: -1 } },
      blastRadiusWu,
      0
    );

    if (weapon.family === 'plasma') {
      this.events.push({
        type: 'plasma-fired',
        center: this.getTankCenter(tank),
        radiusWu: blastRadiusWu,
      });
    }

    this.detonate(projectile, this.getTankCenter(tank), false);
  }

  /** [MANUAL §6] The beam is instant and passes through dirt and shields alike. */
  private fireLaser(tank: TankState): void {
    const origin = this.getTankCenter(tank);
    const direction = getLaunchVelocity({ ...tank.aim, power: 1 });
    const targets = this.getTankViews().filter(view => view.playerId !== tank.playerId);

    this.events.push({
      type: 'laser-fired',
      ownerId: tank.playerId,
      from: origin,
      to: getLaserBeamEnd(origin, direction, this.fieldState.length, FIELD_HEIGHT_WU),
    });

    for (const hit of computeLaserHits(origin, direction, targets)) {
      const target = this.getTank(hit.playerId);

      if (target !== undefined && !isLaserBlockedBy(target.shield)) {
        this.applyDamage(hit.playerId, LASER_DAMAGE, tank.playerId, 'laser');
      }
    }
  }

  private advanceProjectile(projectile: Projectile): void {
    const environment = this.createEnvironment(projectile.guidance);
    const previousPosition = projectile.state.position;
    const previousVelocityY = projectile.state.velocity.y;

    projectile.ticksAlive++;

    if (projectile.rolling !== undefined) {
      this.rollProjectile(projectile, projectile.rolling);

      return;
    }

    if (projectile.pouring !== undefined) {
      this.pourLiquidDirt(projectile, projectile.pouring);

      return;
    }

    if (projectile.ticksAlive > MAX_FLIGHT_TICKS) {
      this.endProjectile(projectile, previousPosition, 'expired');

      return;
    }

    this.updateMuzzleClearance(projectile, previousPosition);

    const steered = this.steerProjectile(projectile);
    const stepResult = stepProjectile({ ...projectile.state, velocity: steered }, environment);

    projectile.state = stepResult.state;

    if (stepResult.bounceSide !== undefined) {
      this.events.push({
        type: 'projectile-bounced',
        projectileId: projectile.id,
        side: stepResult.bounceSide,
      });
    }

    if (stepResult.outcome === 'absorbed') {
      this.endProjectile(projectile, projectile.state.position, 'absorbed');

      return;
    }

    if (this.splitMirvAtApex(projectile, previousVelocityY)) {
      return;
    }

    if (this.resolveTankCollision(projectile, previousPosition)) {
      return;
    }

    const impact = traceTerrainImpact(
      this.fieldState,
      previousPosition,
      projectile.state.position,
      {
        isTunnelingEnabled: this.options.physics.isTunnelingEnabled,
        hasContactTrigger: projectile.hasContactTrigger,
      }
    );

    if (impact !== undefined) {
      // A roller does not go off where it lands: it settles onto the surface and starts crawling.
      if (getWeapon(projectile.weaponId).family === 'roller' && !projectile.hasContactTrigger) {
        this.beginRolling(projectile, impact);

        return;
      }

      if (getWeapon(projectile.weaponId).family === 'liquid-dirt') {
        this.beginPouring(projectile, impact);

        return;
      }

      this.detonate(projectile, impact, false);

      return;
    }

    // Checked after the terrain trace: a shell crossing the floor inside the field must land its
    // bedrock detonation rather than vanish out of bounds.
    if (stepResult.outcome === 'lost') {
      this.endProjectile(projectile, projectile.state.position, 'out-of-bounds');
    }
  }

  private beginRolling(projectile: Projectile, impact: Vector2): void {
    const columnIndex = getColumnIndexAt(this.fieldState, impact.x);
    const direction =
      Math.sign(projectile.state.velocity.x) || getDownhillStep(this.fieldState, columnIndex);

    projectile.state = {
      position: { x: columnIndex + 0.5, y: getSurfaceHeight(this.fieldState, columnIndex) },
      velocity: { x: 0, y: 0 },
    };

    // A shell that fell dead straight onto flat ground has nowhere to roll.
    if (direction === 0) {
      this.detonate(projectile, projectile.state.position, false);

      return;
    }

    projectile.rolling = { direction, travelledColumns: 0, progressWu: 0 };
    this.events.push({ type: 'roller-landed', position: { ...projectile.state.position } });
  }

  /**
   * The roller crawls the surface in its flight direction — over hills too — and detonates on
   * the first tank it touches, or at arm's length from one hiding under a shield. A wall too
   * steep to climb, the field's edge or the travel cap all set it off where it stands.
   */
  private rollProjectile(projectile: Projectile, rolling: RollingState): void {
    const speed = ROLLER_SPEED_WU_PER_TICK[projectile.weaponId] ?? DEFAULT_ROLLER_SPEED_WU_PER_TICK;

    rolling.progressWu += speed;

    while (rolling.progressWu >= 1) {
      rolling.progressWu -= 1;

      const columnIndex = getColumnIndexAt(this.fieldState, projectile.state.position.x);
      const nextColumn = getColumnIndexAt(this.fieldState, columnIndex + rolling.direction);
      const climbWu =
        getSurfaceHeight(this.fieldState, nextColumn) -
        getSurfaceHeight(this.fieldState, columnIndex);
      const isStuck =
        nextColumn === columnIndex ||
        climbWu > ROLLER_MAX_CLIMB_WU_PER_COLUMN ||
        rolling.travelledColumns >= ROLLER_MAX_TRAVEL_COLUMNS;

      if (isStuck) {
        this.detonate(projectile, projectile.state.position, false);

        return;
      }

      rolling.travelledColumns++;
      projectile.state = {
        position: { x: nextColumn + 0.5, y: getSurfaceHeight(this.fieldState, nextColumn) },
        velocity: { x: rolling.direction * speed, y: 0 },
      };

      if (this.detonateRollerOnContact(projectile)) {
        return;
      }
    }
  }

  /** True when the roll just reached a tank: on the hull it is a direct hit, a shield holds it off. */
  private detonateRollerOnContact(projectile: Projectile): boolean {
    const rollX = projectile.state.position.x;

    for (const tank of this.tankStates) {
      if (!tank.isAlive) {
        continue;
      }

      const gapWu = Math.abs(rollX - (tank.columnIndex + 0.5));

      if (tank.shield !== undefined && gapWu <= TANK_HALF_WIDTH_WU + ROLLER_SHIELD_STANDOFF_WU) {
        this.detonate(projectile, projectile.state.position, false);

        return true;
      }

      if (tank.shield === undefined && gapWu <= TANK_HALF_WIDTH_WU) {
        this.detonate(projectile, this.getTankCenter(tank), true);

        return true;
      }
    }

    return false;
  }

  private beginPouring(projectile: Projectile, impact: Vector2): void {
    projectile.state = { position: impact, velocity: { x: 0, y: 0 } };
    projectile.pouring = { remainingPortions: LIQUID_DIRT_POUR_PORTIONS, cooldownTicks: 0 };
  }

  /**
   * Liquid dirt does not appear as one instant plug: the shell sits where it landed and empties
   * itself in portions, each one levelling out through the basin, until the load freezes solid.
   */
  private pourLiquidDirt(projectile: Projectile, pouring: PouringState): void {
    if (pouring.cooldownTicks > 0) {
      pouring.cooldownTicks--;

      return;
    }

    const portionWu = getWeapon(projectile.weaponId).flowVolumeWu / LIQUID_DIRT_POUR_PORTIONS;
    const filled = fillHollows(
      this.fieldState,
      getColumnIndexAt(this.fieldState, projectile.state.position.x),
      portionWu,
      LIQUID_DIRT_MAX_HALF_SPAN_COLUMNS
    );

    this.fieldState = filled.field;
    this.events.push({
      type: 'dirt-poured',
      position: projectile.state.position,
      columns: filled.affectedColumns,
    });

    pouring.remainingPortions--;
    pouring.cooldownTicks = LIQUID_DIRT_POUR_INTERVAL_TICKS;

    if (pouring.remainingPortions <= 0) {
      this.events.push({ type: 'dirt-settled', columns: filled.affectedColumns });
      this.detonate(projectile, projectile.state.position, false);
    }
  }

  /** [MANUAL §7] Heat guidance chases whichever tank is nearest to the shell right now. */
  private getNearestOpponentCenter(ownerId: PlayerId, position: Vector2): Vector2 | undefined {
    let nearest: Vector2 | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const tank of this.tankStates) {
      if (!tank.isAlive || tank.playerId === ownerId) {
        continue;
      }

      const center = this.getTankCenter(tank);
      const distance = Math.hypot(center.x - position.x, center.y - position.y);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = center;
      }
    }

    return nearest;
  }

  private steerProjectile(projectile: Projectile): Vector2 {
    const target =
      projectile.guidance === 'heat-guidance'
        ? (this.getNearestOpponentCenter(projectile.ownerId, projectile.state.position) ??
          projectile.guidanceTarget)
        : projectile.guidanceTarget;
    const guided =
      projectile.guidance === undefined
        ? projectile.state.velocity
        : applyGuidance(
            projectile.guidance,
            projectile.state.position,
            projectile.state.velocity,
            target,
            // A flat shot never crosses an apex, so a sinking velocity counts as descending too.
            projectile.hasPassedApex || projectile.state.velocity.y <= 0
          );
    const foreignDeflectors = this.magDeflectors.filter(
      deflector => deflector.ownerId !== projectile.ownerId
    );
    const deflection = applyMagDeflection(projectile.state.position, guided, foreignDeflectors);

    this.magDeflectors = this.magDeflectors.map(
      deflector =>
        deflection.deflectors.find(updated => updated.ownerId === deflector.ownerId) ?? deflector
    );
    this.reportMagDeflection(projectile, foreignDeflectors, deflection.deflectors);

    return deflection.velocity;
  }

  /** Only the tick a deflector takes hold is announced; the push itself lasts the whole pass. */
  private reportMagDeflection(
    projectile: Projectile,
    before: readonly MagDeflectorState[],
    after: readonly MagDeflectorState[]
  ): void {
    const grabbing = after.find(deflector => {
      const previous = before.find(candidate => candidate.ownerId === deflector.ownerId);

      return previous !== undefined && deflector.remainingCapacity < previous.remainingCapacity;
    });

    if (grabbing !== undefined && !projectile.isMagDeflected) {
      this.events.push({
        type: 'mag-deflected',
        playerId: grabbing.ownerId,
        projectileId: projectile.id,
      });
    }

    projectile.isMagDeflected = grabbing !== undefined;
  }

  private splitMirvAtApex(projectile: Projectile, previousVelocityY: number): boolean {
    if (
      projectile.hasPassedApex ||
      !hasCrossedApex(previousVelocityY, projectile.state.velocity.y)
    ) {
      return false;
    }

    projectile.hasPassedApex = true;

    const weapon = getWeapon(projectile.weaponId);
    const warheads = splitAtApex(weapon, projectile.state);

    if (warheads === undefined) {
      return false;
    }

    this.removeProjectile(projectile);

    for (const warhead of warheads) {
      const spawned = this.spawnWarhead(
        projectile,
        warhead.state,
        warhead.blastRadiusWu,
        warhead.stageIndex
      );

      this.events.push({
        type: 'projectile-launched',
        projectileId: spawned.id,
        ownerId: spawned.ownerId,
        weaponId: spawned.weaponId,
        position: spawned.state.position,
        velocity: spawned.state.velocity,
      });
    }

    return true;
  }

  /** Sub-warheads inherit the shot's Contact Trigger — one trigger covers the whole shot. */
  private spawnWarhead(
    parent: Projectile,
    state: ProjectileState,
    blastRadiusWu: number,
    stageIndex: number
  ): Projectile {
    const warhead: Projectile = {
      id: this.nextProjectileId++,
      ownerId: parent.ownerId,
      weaponId: parent.weaponId,
      shotId: parent.shotId,
      hasContactTrigger: parent.hasContactTrigger,
      guidance: undefined,
      guidanceTarget: undefined,
      blastRadiusWu,
      stageIndex,
      state,
      rolling: undefined,
      pouring: undefined,
      hasPassedApex: true,
      hasClearedOwner: true,
      isMagDeflected: false,
      ticksAlive: 0,
    };

    this.projectileList.push(warhead);

    return warhead;
  }

  /**
   * Evaluated against the position the shell started the tick at: the tick that carries it out
   * of its own hull must still ignore the launcher, or the outbound segment clips it.
   */
  private updateMuzzleClearance(projectile: Projectile, position: Vector2): void {
    if (projectile.hasClearedOwner) {
      return;
    }

    const owner = this.getTank(projectile.ownerId);

    projectile.hasClearedOwner = owner === undefined || !isInsideTankBox(owner, position);
  }

  private resolveTankCollision(projectile: Projectile, previousPosition: Vector2): boolean {
    const struck = this.findStruckTank(projectile, previousPosition, projectile.state.position);

    if (struck === undefined) {
      return false;
    }

    const interaction = resolveShieldInteraction(
      struck.shield,
      struck.playerId === projectile.ownerId
    );

    switch (interaction) {
      case 'absorb-direct-hit':
        this.applyShieldAbsorption(
          struck,
          absorbWithShield(struck.shield, getBlastPeakDamage(projectile.blastRadiusWu))
        );
        this.endProjectile(projectile, projectile.state.position, 'shield');

        return true;
      case 'deflect':
        projectile.state = {
          position: previousPosition,
          velocity: {
            x: -projectile.state.velocity.x,
            y: Math.abs(projectile.state.velocity.y),
          },
        };
        this.events.push({
          type: 'shield-deflected',
          playerId: struck.playerId,
          projectileId: projectile.id,
        });
        // Turning a shell around costs the bubble as much as eating it would have: without this
        // the force tier's capacity was never spent, so it deflected for ever and made the dearer
        // Heavy Shield — which merely absorbs — a worse buy at every price.
        this.applyShieldAbsorption(
          struck,
          absorbWithShield(struck.shield, getBlastPeakDamage(projectile.blastRadiusWu))
        );

        return true;
      case 'none':
      case 'pass-through':
        this.detonate(projectile, projectile.state.position, true);

        return true;
      default:
        return assertNever(interaction);
    }
  }

  private findStruckTank(
    projectile: Projectile,
    from: Vector2,
    to: Vector2
  ): TankState | undefined {
    const stepCount = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y)));

    for (let step = 1; step <= stepCount; step++) {
      const progress = step / stepCount;
      const probe: Vector2 = {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      };
      const struck = this.tankStates.find(
        tank =>
          tank.isAlive &&
          (projectile.hasClearedOwner || tank.playerId !== projectile.ownerId) &&
          isInsideTankBox(tank, probe)
      );

      if (struck !== undefined) {
        return struck;
      }
    }

    return undefined;
  }

  private detonate(projectile: Projectile, impact: Vector2, isDirectTankHit: boolean): void {
    this.removeProjectile(projectile);

    const weapon = getWeapon(projectile.weaponId);
    const effects = resolveImpact(weapon, {
      field: this.fieldState,
      impact,
      velocity: projectile.state.velocity,
      blastRadiusWu: projectile.blastRadiusWu,
      stageIndex: projectile.stageIndex,
      tanks: this.getTankViews(),
    });

    this.events.push({
      type: 'projectile-ended',
      projectileId: projectile.id,
      position: impact,
      reason: isDirectTankHit ? 'tank' : 'terrain',
    });

    for (const effect of effects) {
      this.applyEffect(projectile, effect);
    }

    this.applyTankFalls();
  }

  private applyEffect(projectile: Projectile, effect: ImpactEffect): void {
    switch (effect.kind) {
      case 'explosion':
        this.applyExplosion(projectile, effect.center, effect.radiusWu);
        break;
      case 'carve':
        this.carve(effect.center, effect.radiusWu);
        break;
      case 'carve-wedge': {
        const carved = carveWedge(this.fieldState, effect.apex, effect.radiusWu);

        this.noteSettling(carved.field, carved.affectedColumns);
        this.fieldState = carved.field;
        this.events.push({
          type: 'terrain-carved',
          shape: 'wedge',
          center: effect.apex,
          radiusWu: effect.radiusWu,
        });
        break;
      }
      case 'deposit':
        this.fieldState = depositCircle(this.fieldState, effect.center, effect.radiusWu).field;
        this.events.push({
          type: 'terrain-deposited',
          center: effect.center,
          radiusWu: effect.radiusWu,
        });
        break;
      case 'deposit-wedge':
        this.fieldState = depositWedge(this.fieldState, effect.apex, effect.radiusWu).field;
        this.events.push({
          type: 'terrain-deposited',
          center: effect.apex,
          radiusWu: effect.radiusWu,
        });
        break;
      case 'napalm':
        this.events.push({ type: 'napalm-pooled', pools: effect.pools });

        for (const damage of computeNapalmDamage(effect.pools, this.getTankViews())) {
          this.applyDamage(damage.playerId, damage.amount, projectile.ownerId, 'napalm');
        }
        break;
      case 'spawn-warheads':
        for (const warhead of effect.warheads) {
          this.spawnWarhead(projectile, warhead.state, warhead.blastRadiusWu, warhead.stageIndex);
        }
        break;
      default:
        assertNever(effect);
    }
  }

  private carve(center: Vector2, radiusWu: number): void {
    const carved = applyBlastToTerrain(this.fieldState, center, radiusWu);

    this.noteSettling(carved.field, carved.affectedColumns);
    this.fieldState = carved.field;
    this.events.push({ type: 'terrain-carved', shape: 'circle', center, radiusWu });
  }

  /** Extends the settling wait to cover the deepest drop this carve just caused. */
  private noteSettling(carvedField: Heightfield, affectedColumns: readonly number[]): void {
    this.extendSettleByDrop(
      affectedColumns.reduce(
        (deepest, column) =>
          Math.max(
            deepest,
            getSurfaceHeight(this.fieldState, column) - getSurfaceHeight(carvedField, column)
          ),
        0
      )
    );
  }

  private extendSettleByDrop(dropWu: number): void {
    if (dropWu <= 0) {
      return;
    }

    const fallTicks = Math.ceil(Math.sqrt((2 * dropWu) / COLLAPSE_GRAVITY_WU_PER_TICK_SQUARED));

    this.settleTicksRemaining = Math.max(
      this.settleTicksRemaining,
      fallTicks + COLLAPSE_SETTLE_MARGIN_TICKS
    );
  }

  private applyExplosion(projectile: Projectile, center: Vector2, radiusWu: number): void {
    this.events.push({
      type: 'explosion',
      position: center,
      radiusWu,
      weaponId: projectile.weaponId,
    });
    this.carve(center, radiusWu);

    const targets = this.tankStates
      .filter(tank => tank.isAlive)
      .map(tank => ({ playerId: tank.playerId, position: this.getTankCenter(tank) }));

    for (const damage of computeBlastDamage(center, radiusWu, targets)) {
      this.applyDamage(damage.playerId, damage.amount, projectile.ownerId, 'blast');
    }
  }

  private applyShieldAbsorption(tank: TankState, absorption: ShieldAbsorption): void {
    tank.shield = absorption.shield;
    this.events.push({
      type: 'shield-absorbed',
      playerId: tank.playerId,
      amount: absorption.absorbed,
      remaining: absorption.shield?.remaining ?? 0,
    });

    if (absorption.shield === undefined) {
      this.events.push({ type: 'shield-collapsed', playerId: tank.playerId });
      this.autoRaiseNextShield(tank);
    }
  }

  /** [MANUAL §7] Auto Defense keeps watch all round: a collapsed bubble is replaced on the spot. */
  private autoRaiseNextShield(tank: TankState): void {
    if (this.getItemCount(tank.playerId, 'auto-defense') <= 0) {
      return;
    }

    const nextItemId = selectBestShieldItem(itemId => this.getItemCount(tank.playerId, itemId));
    const shield = isNil(nextItemId) ? undefined : createShield(nextItemId);

    if (isNil(nextItemId) || shield === undefined) {
      return;
    }

    this.consumeItem(tank.playerId, nextItemId);
    tank.shield = shield;
    this.events.push({ type: 'shield-raised', playerId: tank.playerId, tier: shield.tier });
  }

  /**
   * [MANUAL §7] The bubble soaks indirect damage no matter who fired the shell — including the
   * owner's own descending shot, which is what makes the suicide survivable but not safe.
   */
  private applyDamage(
    playerId: PlayerId,
    amount: number,
    sourceId: PlayerId | undefined,
    cause: DamageCause
  ): void {
    const tank = this.getTank(playerId);

    if (tank === undefined || !tank.isAlive || amount <= 0) {
      return;
    }

    const absorption = absorbWithShield(tank.shield, amount);

    if (absorption.absorbed > 0) {
      this.applyShieldAbsorption(tank, absorption);
    }

    if (absorption.passedThrough <= 0) {
      return;
    }

    tank.health = Math.max(MIN_TANK_HEALTH, tank.health - absorption.passedThrough);
    this.damageRecords.push({
      dealerId: sourceId,
      targetId: playerId,
      amount: absorption.passedThrough,
    });
    this.events.push({
      type: 'tank-damaged',
      playerId,
      sourceId,
      amount: absorption.passedThrough,
      cause,
      health: tank.health,
    });

    if (tank.health <= MIN_TANK_HEALTH) {
      this.destroyTank(tank, sourceId);
    }
  }

  private destroyTank(tank: TankState, killerId: PlayerId | undefined): void {
    tank.isAlive = false;
    this.killRecords.push({ killerId, victimId: tank.playerId });
    this.events.push({ type: 'tank-destroyed', playerId: tank.playerId, killerId });
  }

  /** Dirt lost under a tank drops it; the tank rides the settling sand down, gently and free. */
  private applyTankFalls(): void {
    if (!this.options.physics.areTankFallsEnabled) {
      return;
    }

    const falls = computeTankFalls(
      this.fieldState,
      this.tankStates
        .filter(tank => tank.isAlive)
        .map(tank => ({
          playerId: tank.playerId,
          columnIndex: tank.columnIndex,
          positionY: tank.positionY,
        }))
    );

    for (const fall of falls) {
      const tank = this.getTank(fall.playerId);

      if (tank === undefined) {
        continue;
      }

      this.extendSettleByDrop(fall.fallDistanceWu);

      this.events.push({
        type: 'tank-fell',
        playerId: fall.playerId,
        fromY: fall.fromY,
        toY: fall.toY,
      });
      tank.positionY = fall.toY;
    }
  }

  private endProjectile(
    projectile: Projectile,
    position: Vector2,
    reason: ProjectileEndReason
  ): void {
    this.removeProjectile(projectile);
    this.events.push({ type: 'projectile-ended', projectileId: projectile.id, position, reason });
  }

  private removeProjectile(projectile: Projectile): void {
    this.projectileList = this.projectileList.filter(candidate => candidate !== projectile);
  }

  private countAliveTanks(): number {
    return this.tankStates.filter(tank => tank.isAlive).length;
  }

  private endRoundIfDecided(): boolean {
    if (this.countAliveTanks() >= MIN_TANKS_ALIVE_TO_CONTINUE) {
      return false;
    }

    this.phaseValue = 'ended';
    this.events.push({
      type: 'round-ended',
      survivorIds: this.tankStates.filter(tank => tank.isAlive).map(tank => tank.playerId),
    });

    return true;
  }

  private finishTurn(): void {
    const finishedId = this.turnOrder[this.turnIndex];

    this.phaseValue = 'settling';
    this.events.push({ type: 'turn-ended', playerId: finishedId });

    if (this.options.physics.isWindChanging) {
      this.windValue = rollWind(this.options.physics.maxWind);
      this.events.push({ type: 'wind-changed', windUnits: this.windValue });
    }

    if (this.endRoundIfDecided()) {
      return;
    }

    this.advanceToNextLivingPlayer();
    this.phaseValue = 'aiming';
    this.openTurn();
  }

  private openTurn(): void {
    this.events.push({ type: 'turn-started', playerId: this.turnOrder[this.turnIndex] });
  }

  private advanceToNextLivingPlayer(): void {
    for (let step = 1; step <= this.turnOrder.length; step++) {
      const candidateIndex = (this.turnIndex + step) % this.turnOrder.length;
      const candidate = this.tankStates.find(
        tank => tank.playerId === this.turnOrder[candidateIndex]
      );

      if (candidate?.isAlive === true) {
        this.turnIndex = candidateIndex;

        return;
      }
    }
  }
}
