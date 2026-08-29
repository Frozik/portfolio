import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil, shuffle } from 'lodash-es';
import { refineAimForWind } from './ai/aim-solver';
import type { BallisticsEnvironment } from './ballistics';
import {
  clampAim,
  createEnvironment,
  getLaunchOrigin,
  getLaunchVelocity,
  getMaxPower,
  isPerShotWallMode,
  resolveWallMode,
  rollWind,
} from './ballistics';
import {
  BATTERY_HEALTH_BONUS,
  COLLAPSE_GRAVITY_WU_PER_TICK_SQUARED,
  COLLAPSE_SETTLE_MARGIN_TICKS,
  FIELD_HEIGHT_WU,
  LASER_DAMAGE,
  MIN_TANK_HEALTH,
  MIN_TANKS_ALIVE_TO_CONTINUE,
} from './constants';
import type { ImpactResolutionContext } from './impact-resolution';
import { detonate } from './impact-resolution';
import type { ShieldAbsorption } from './items';
import {
  absorbWithShield,
  applyBatteries,
  createMagDeflector,
  createShield,
  getGuidedWindAcceleration,
  isLaserBlockedBy,
  isPermanentItem,
  moveWithFuel,
  selectBestShieldItem,
} from './items';
import type { ProjectileFlightContext } from './projectile-flight';
import { advanceProjectile } from './projectile-flight';
import { RoundInventories } from './round-inventory';
import type { DamageRecord, KillRecord, RoundOutcome } from './scoring';
import { getTankCenter, getTankViews } from './tank-geometry';
import type { Heightfield } from './terrain/heightfield';
import { getSurfaceHeight } from './terrain/heightfield';
import type {
  AimState,
  DamageCause,
  GuidanceKind,
  ItemId,
  MagDeflectorState,
  PhysicsOptions,
  PlayerId,
  PlayerInventory,
  PlayOrder,
  Projectile,
  ProjectileEndReason,
  ProjectileState,
  ResolvedWallMode,
  RoundPhase,
  TankState,
  WeaponId,
  WorldEvent,
} from './types';
import { computeLaserHits, getLaserBeamEnd, getPlasmaRadius } from './weapons/behaviors';
import type { WeaponDefinition } from './weapons/catalog';
import { getWeapon } from './weapons/catalog';

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

/**
 * One round of hot-seat artillery: sequential turns, one shot each, resolved to the last tank
 * standing. It owns no timers and no rendering — the application ticks it at a fixed 60 Hz
 * while a shot is in the air and reads the events it returns.
 *
 * Flight and detonation rules live in `projectile-flight` and `impact-resolution`; this class
 * owns the turn, the world they act on, and the ledgers they report into.
 */
export class ScorchedRound {
  /** Reused between calls — consumers must read it before driving the round again. */
  private readonly events: WorldEvent[] = [];
  private readonly options: RoundOptions;
  private readonly tankStates: TankState[];
  private readonly inventories: RoundInventories;
  private readonly damageRecords: DamageRecord[] = [];
  private readonly killRecords: KillRecord[] = [];
  private readonly retreatedIds: PlayerId[] = [];
  private readonly worldContext: ProjectileFlightContext & ImpactResolutionContext;
  private fieldState: Heightfield;
  private projectileList: Projectile[] = [];
  private magDeflectors: readonly MagDeflectorState[] = [];
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
    this.inventories = new RoundInventories(options.players);

    const aliveIds = this.tankStates.filter(tank => tank.isAlive).map(tank => tank.playerId);

    this.turnOrder = options.playOrder === 'random' ? shuffle(aliveIds) : aliveIds;
    this.magDeflectors = this.createMagDeflectors();
    this.worldContext = this.createWorldContext();
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
    return this.inventories.getAmmoCount(playerId, weaponId);
  }

  getItemCount(playerId: PlayerId, itemId: ItemId): number {
    return this.inventories.getItemCount(playerId, itemId);
  }

  /** What the locker holds after the round's spending — the match banks this between rounds. */
  getRemainingInventory(playerId: PlayerId): PlayerInventory {
    return this.inventories.getRemainingInventory(playerId);
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

    if (!this.inventories.consumeAmmo(tank.playerId, weapon)) {
      return this.events;
    }

    if (isPerShotWallMode(this.options.physics.wallMode)) {
      this.wallMode = resolveWallMode(this.options.physics.wallMode);
    }

    const shotId = this.nextShotId++;
    const hasContactTrigger = this.inventories.consumeContactTrigger(
      tank.playerId,
      fireOptions.useContactTrigger
    );

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
      position: getTankCenter(tank),
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

    if (shield === undefined || this.inventories.consumeItem(tank.playerId, itemId) <= 0) {
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

    this.inventories.consumeItem(tank.playerId, 'battery', use.consumed);
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

    this.inventories.consumeItem(tank.playerId, 'fuel', chargedUnits);
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
      advanceProjectile(this.worldContext, projectile);
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

  private createWorldContext(): ProjectileFlightContext & ImpactResolutionContext {
    return {
      getField: () => this.fieldState,
      setField: field => {
        this.fieldState = field;
      },
      getTanks: () => this.tankStates,
      getPhysics: () => this.options.physics,
      getMagDeflectors: () => this.magDeflectors,
      setMagDeflectors: deflectors => {
        this.magDeflectors = deflectors;
      },
      createEnvironment: guidance => this.createEnvironment(guidance),
      pushEvent: event => {
        this.events.push(event);
      },
      getTank: playerId => this.getTank(playerId),
      spawnWarhead: (parent, state, blastRadiusWu, stageIndex) =>
        this.spawnWarhead(parent, state, blastRadiusWu, stageIndex),
      removeProjectile: projectile => {
        this.removeProjectile(projectile);
      },
      endProjectile: (projectile, position, reason) => {
        this.endProjectile(projectile, position, reason);
      },
      // Read lazily rather than closed over: the context is still being built here, and a shell
      // that splits mid-flight needs the same one back when its warheads go off.
      detonate: (projectile, impact, isDirectTankHit) => {
        detonate(this.worldContext, projectile, impact, isDirectTankHit);
      },
      applyShieldAbsorption: (tank, absorption) => {
        this.applyShieldAbsorption(tank, absorption);
      },
      extendSettleByDrop: dropWu => {
        this.extendSettleByDrop(dropWu);
      },
      applyDamage: (playerId, amount, sourceId, cause) => {
        this.applyDamage(playerId, amount, sourceId, cause);
      },
    };
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

    return this.inventories.consumeItem(tank.playerId, guidance) > 0 ? guidance : undefined;
  }

  /** [MANUAL §7] Lazy Boy aims the tank by itself — wind-aware — before the trigger drops. */
  private applyLazyBoyAim(tank: TankState, target: Vector2 | undefined): void {
    if (target === undefined) {
      return;
    }

    const solved = refineAimForWind(
      getTankCenter(tank),
      target,
      this.createEnvironment(undefined),
      this.fieldState,
      getMaxPower(tank.health)
    );

    if (solved !== undefined) {
      tank.aim = clampAim(solved, tank.health);
    }
  }

  private getActiveTank(): TankState | undefined {
    const playerId = this.turnOrder[this.turnIndex];

    return this.tankStates.find(tank => tank.playerId === playerId && tank.isAlive);
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

  private createMagDeflectors(): readonly MagDeflectorState[] {
    return this.tankStates.flatMap(tank => {
      const itemId = MAG_DEFLECTOR_PREFERENCE.find(
        candidate => this.inventories.getItemCount(tank.playerId, candidate) > 0
      );

      return itemId === undefined
        ? []
        : [createMagDeflector(itemId, tank.playerId, getTankCenter(tank))];
    });
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
        ? this.inventories.consumeItem(tank.playerId, 'battery', fireOptions.plasmaBatteries ?? 1)
        : 0;
    const blastRadiusWu =
      weapon.family === 'plasma' ? getPlasmaRadius(batteries) : weapon.blastRadiusWu;
    const projectile = this.createProjectile(
      tank,
      weapon,
      fireOptions,
      shotId,
      hasContactTrigger,
      { position: getTankCenter(tank), velocity: { x: 0, y: -1 } },
      blastRadiusWu,
      0
    );

    if (weapon.family === 'plasma') {
      this.events.push({
        type: 'plasma-fired',
        center: getTankCenter(tank),
        radiusWu: blastRadiusWu,
      });
    }

    detonate(this.worldContext, projectile, getTankCenter(tank), false);
  }

  /** [MANUAL §6] The beam is instant and passes through dirt and shields alike. */
  private fireLaser(tank: TankState): void {
    const origin = getTankCenter(tank);
    const direction = getLaunchVelocity({ ...tank.aim, power: 1 });
    const targets = getTankViews(this.tankStates).filter(view => view.playerId !== tank.playerId);

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

    this.inventories.consumeItem(tank.playerId, nextItemId);
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
