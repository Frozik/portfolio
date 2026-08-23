import type { Vector2 } from '@frozik/utils/math/vector2';

export type PlayerId = number;

export type TurretFacing = 'left' | 'right';

/**
 * [MANUAL §5] Aim is a facing side plus an elevation of 0–90°, never a single 0–180° angle:
 * the turret flips sides rather than passing through the vertical.
 */
export interface AimState {
  readonly facing: TurretFacing;
  readonly elevationDegrees: number;
  readonly power: number;
}

export type AiPersonality =
  | 'moron'
  | 'shooter'
  | 'poolshark'
  | 'tosser'
  | 'chooser'
  | 'spoiler'
  | 'cyborg'
  | 'unknown';

export type PlayerController =
  | { readonly kind: 'human' }
  | {
      readonly kind: 'ai';
      readonly personality: AiPersonality;
    };

export type WallMode =
  | 'none'
  | 'concrete'
  | 'padded'
  | 'rubber'
  | 'spring'
  | 'wrap'
  | 'random'
  | 'erratic';

/** A wall mode with the two "pick one" settings already resolved into a concrete behaviour. */
export type ResolvedWallMode = Exclude<WallMode, 'random' | 'erratic'>;

export type WallSide = 'left' | 'right' | 'top';

export type WeaponId =
  | 'baby-missile'
  | 'missile'
  | 'baby-nuke'
  | 'nuke'
  | 'leap-frog'
  | 'funky-bomb'
  | 'mirv'
  | 'deaths-head'
  | 'napalm'
  | 'hot-napalm'
  | 'baby-roller'
  | 'roller'
  | 'heavy-roller'
  | 'riot-charge'
  | 'riot-blast'
  | 'riot-bomb'
  | 'heavy-riot-bomb'
  | 'dirt-clod'
  | 'dirt-ball'
  | 'ton-of-dirt'
  | 'liquid-dirt'
  | 'dirt-charge'
  | 'plasma-blast'
  | 'laser';

/** Weapons sharing a family share their flight and impact behaviour (§6). */
export type WeaponFamily =
  | 'ballistic'
  | 'leapfrog'
  | 'funky'
  | 'mirv'
  | 'napalm'
  | 'roller'
  | 'riot-charge'
  | 'riot-bomb'
  | 'dirt-deposit'
  | 'liquid-dirt'
  | 'dirt-charge'
  | 'plasma'
  | 'laser';

export type ItemId =
  | 'heat-guidance'
  | 'ballistic-guidance'
  | 'horizontal-guidance'
  | 'vertical-guidance'
  | 'lazy-boy'
  | 'battery'
  | 'mag-deflector'
  | 'shield'
  | 'force-shield'
  | 'heavy-shield'
  | 'super-mag'
  | 'auto-defense'
  | 'fuel'
  | 'contact-trigger';

export type ShieldTier = 'shield' | 'force' | 'heavy';

export type GuidanceKind =
  | 'heat-guidance'
  | 'ballistic-guidance'
  | 'horizontal-guidance'
  | 'vertical-guidance'
  | 'lazy-boy';

export interface ShieldState {
  readonly tier: ShieldTier;
  readonly remaining: number;
  /** [MANUAL §7] Only the Super Mag shrugs the laser off. */
  readonly isLaserImmune: boolean;
}

export type WeaponCounts = Readonly<Partial<Record<WeaponId, number>>>;

export type ItemCounts = Readonly<Partial<Record<ItemId, number>>>;

export interface PlayerInventory {
  readonly weapons: WeaponCounts;
  readonly items: ItemCounts;
}

export interface MagDeflectorState {
  readonly ownerId: PlayerId;
  readonly position: Vector2;
  readonly radiusWu: number;
  readonly accelerationWuPerTickSquared: number;
  readonly remainingCapacity: number;
}

export interface TankState {
  readonly playerId: PlayerId;
  /** Column index the tank sits on; its base y is the column's surface height. */
  columnIndex: number;
  positionY: number;
  health: number;
  aim: AimState;
  shield: ShieldState | undefined;
  /** Fuel already paid for but not yet burned — the fraction left over from the last charge. */
  fuelCreditWu: number;
  isAlive: boolean;
  hasRetreated: boolean;
}

export interface ProjectileState {
  readonly position: Vector2;
  readonly velocity: Vector2;
}

/** A landed roller crawling the surface, column by column, until something stops it. */
export interface RollingState {
  /** Locked at landing to the flight's horizontal direction — a roller never turns around. */
  readonly direction: number;
  travelledColumns: number;
  progressWu: number;
}

/** A landed liquid dirt shell emptying itself portion by portion until the load runs out. */
export interface PouringState {
  remainingPortions: number;
  cooldownTicks: number;
}

export interface Projectile {
  readonly id: number;
  readonly ownerId: PlayerId;
  readonly weaponId: WeaponId;
  /** All warheads born from one trigger pull share this id — Contact Triggers cover them all. */
  readonly shotId: number;
  readonly hasContactTrigger: boolean;
  readonly guidance: GuidanceKind | undefined;
  readonly guidanceTarget: Vector2 | undefined;
  /** Blast radius for this specific warhead; plasma and leapfrog hops vary it per stage. */
  readonly blastRadiusWu: number;
  /** Which leapfrog hop or MIRV generation this warhead belongs to. */
  readonly stageIndex: number;
  state: ProjectileState;
  /** Present once a roller has landed and is crawling the surface instead of flying. */
  rolling: RollingState | undefined;
  /** Present once a liquid dirt shell has landed and is pouring its load into the hollow. */
  pouring: PouringState | undefined;
  hasPassedApex: boolean;
  /**
   * A shell leaves from inside its own tank's box, so it must ignore the launcher until it is
   * clear of it — otherwise every shot detonates on the muzzle. Once clear, the owner becomes a
   * target again, which is what makes the manual's own-descending-shot suicide possible.
   */
  hasClearedOwner: boolean;
  /**
   * Whether a mag deflector had hold of the shell on the previous tick. A deflector pushes every
   * tick a shell is inside it, so only the rising edge is worth an event — otherwise a single pass
   * would report a dozen deflections and the sound would turn into a buzz.
   */
  isMagDeflected: boolean;
  ticksAlive: number;
}

export interface PhysicsOptions {
  readonly gravity: number;
  readonly maxWind: number;
  readonly isWindChanging: boolean;
  readonly viscosity: number;
  readonly wallMode: WallMode;
  readonly isBordersExtendEnabled: boolean;
  readonly isTunnelingEnabled: boolean;
  readonly areTankFallsEnabled: boolean;
}

export interface TerrainOptions {
  readonly bumpiness: number;
  readonly slope: number;
  readonly flattenPeaks: number;
}

export type PlayOrder = 'sequential' | 'random';

export interface PlayerSetup {
  readonly id: PlayerId;
  readonly name: string;
  readonly controller: PlayerController;
}

export interface MatchOptions {
  readonly players: readonly PlayerSetup[];
  readonly roundCount: number;
  readonly startingCash: number;
  readonly interestPercent: number;
  readonly armsLevel: number;
  readonly playOrder: PlayOrder;
  readonly physics: PhysicsOptions;
  readonly terrain: TerrainOptions;
}

export type RoundPhase = 'aiming' | 'flight' | 'settling' | 'ended';

export type MatchPhase = 'round' | 'shop' | 'finished';

export type DamageCause = 'blast' | 'napalm' | 'laser' | 'direct-hit';

export type ProjectileEndReason =
  | 'terrain'
  | 'tank'
  | 'shield'
  | 'absorbed'
  | 'out-of-bounds'
  | 'expired';

export type CarveShape = 'circle' | 'wedge';

export interface HeightSpan {
  readonly bottom: number;
  readonly top: number;
}

/** One napalm stream: a run of columns coated in fire, hugging the terrain profile. */
export interface NapalmPool {
  readonly firstColumn: number;
  /** Surface height of each covered column from `firstColumn` on — flames and char follow it. */
  readonly surfaceHeights: readonly number[];
}

export type WorldEvent =
  | { readonly type: 'round-started'; readonly roundNumber: number; readonly windUnits: number }
  | { readonly type: 'turn-started'; readonly playerId: PlayerId }
  | { readonly type: 'turn-ended'; readonly playerId: PlayerId }
  | { readonly type: 'wind-changed'; readonly windUnits: number }
  | { readonly type: 'roller-landed'; readonly position: Vector2 }
  | { readonly type: 'plasma-fired'; readonly center: Vector2; readonly radiusWu: number }
  | {
      readonly type: 'projectile-launched';
      readonly projectileId: number;
      readonly ownerId: PlayerId;
      readonly weaponId: WeaponId;
      readonly position: Vector2;
      readonly velocity: Vector2;
    }
  | {
      readonly type: 'projectile-ended';
      readonly projectileId: number;
      readonly position: Vector2;
      readonly reason: ProjectileEndReason;
    }
  | { readonly type: 'projectile-bounced'; readonly projectileId: number; readonly side: WallSide }
  | {
      readonly type: 'explosion';
      readonly position: Vector2;
      readonly radiusWu: number;
      readonly weaponId: WeaponId;
    }
  | {
      readonly type: 'terrain-carved';
      readonly shape: CarveShape;
      readonly center: Vector2;
      readonly radiusWu: number;
    }
  | { readonly type: 'terrain-deposited'; readonly center: Vector2; readonly radiusWu: number }
  | {
      /** [MANUAL §6] The laser leaves no crater, so the beam itself is the only thing to draw. */
      readonly type: 'laser-fired';
      readonly ownerId: PlayerId;
      readonly from: Vector2;
      readonly to: Vector2;
    }
  | { readonly type: 'dirt-settled'; readonly columns: readonly number[] }
  | {
      readonly type: 'dirt-poured';
      readonly position: Vector2;
      readonly columns: readonly number[];
    }
  | { readonly type: 'napalm-pooled'; readonly pools: readonly NapalmPool[] }
  | {
      readonly type: 'tank-damaged';
      readonly playerId: PlayerId;
      readonly sourceId: PlayerId | undefined;
      readonly amount: number;
      readonly cause: DamageCause;
      readonly health: number;
    }
  | {
      readonly type: 'shield-absorbed';
      readonly playerId: PlayerId;
      readonly amount: number;
      readonly remaining: number;
    }
  | {
      /** [MANUAL §7] A bubble the tank put up itself, out of its own locker, on its own turn. */
      readonly type: 'shield-raised';
      readonly playerId: PlayerId;
      readonly tier: ShieldTier;
    }
  | { readonly type: 'shield-collapsed'; readonly playerId: PlayerId }
  | {
      readonly type: 'shield-deflected';
      readonly playerId: PlayerId;
      readonly projectileId: number;
    }
  | {
      /** A mag deflector took hold of a passing shell; only the tick it grabs it is reported. */
      readonly type: 'mag-deflected';
      readonly playerId: PlayerId;
      readonly projectileId: number;
    }
  | {
      /** [MANUAL §7] A battery spent in the field: ten health back, one battery gone. */
      readonly type: 'tank-repaired';
      readonly playerId: PlayerId;
      readonly amount: number;
      readonly health: number;
    }
  | {
      /** [MANUAL §7] Fuel spent driving out of a crater; the tank ends up on `columnIndex`. */
      readonly type: 'tank-moved';
      readonly playerId: PlayerId;
      readonly columnIndex: number;
      readonly positionY: number;
    }
  | {
      readonly type: 'tank-fell';
      readonly playerId: PlayerId;
      readonly fromY: number;
      readonly toY: number;
    }
  | {
      readonly type: 'tank-destroyed';
      readonly playerId: PlayerId;
      readonly killerId: PlayerId | undefined;
    }
  | {
      readonly type: 'tank-retreated';
      readonly playerId: PlayerId;
      /** Where the helicopter picks the tank up, so the renderer can fly it out from there. */
      readonly position: Vector2;
    }
  | { readonly type: 'round-ended'; readonly survivorIds: readonly PlayerId[] };
