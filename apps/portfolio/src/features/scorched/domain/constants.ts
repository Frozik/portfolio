import type {
  PhysicsOptions,
  ResolvedWallMode,
  ShieldTier,
  TerrainOptions,
  WeaponId,
} from './types';

/** [MANUAL §4] Logical battlefield: one wu = one terrain column = one logical pixel. */
export const FIELD_WIDTH_WU = 800;
export const FIELD_HEIGHT_WU = 500;
export const TERRAIN_COLUMN_COUNT = FIELD_WIDTH_WU;

export const TICKS_PER_SECOND = 60;

const TANK_WIDTH_WU = 14;
export const TANK_HEIGHT_WU = 8;
export const TANK_HALF_WIDTH_WU = TANK_WIDTH_WU / 2;
/** Height above the ground at which a shell leaves the barrel and a blast is centred. */
export const TANK_CENTER_OFFSET_WU = TANK_HEIGHT_WU / 2;

/** Where the visual gun pivots and how far its muzzle reaches — shells spawn at the muzzle. */
export const GUN_PIVOT_ABOVE_BASE_WU = 8;
/** The gun mounts on the turret's front face, this far from the tank's centre. */
export const GUN_MOUNT_OFFSET_WU = 4.5;
export const GUN_BARREL_LENGTH_WU = 13.5;

/** [MANUAL §5] Health is the original's "power": 0 destroys the tank. */
export const MIN_TANK_HEALTH = 0;
export const MAX_TANK_HEALTH = 100;
/** [MANUAL §5] Damage directly caps firepower — a tank at 40 health fires at most 400. */
export const POWER_PER_HEALTH_POINT = 10;
export const MIN_POWER = 0;
export const MAX_POWER = MAX_TANK_HEALTH * POWER_PER_HEALTH_POINT;

/** [MANUAL §5] Elevation is 0–90° per facing side; the turret flips instead of exceeding 90°. */
export const MIN_ELEVATION_DEGREES = 0;
export const MAX_ELEVATION_DEGREES = 90;

/** [MANUAL §5] Gravity option range and default, in the original's units. */
export const MIN_GRAVITY = 0.05;
export const MAX_GRAVITY = 10;
export const DEFAULT_GRAVITY = 0.2;
/**
 * §15.2, resolved at M4. The pair below is calibrated together against one target: **a full-power
 * 45° shot spans the whole 800 wu field**, so the two extreme tanks of a wide roster can just
 * barely reach each other and every shorter shot is a fraction of the dial the player can feel.
 *
 * Full power 1000 × {@link POWER_TO_SPEED_WU_PER_TICK} = 8 wu/tick at the muzzle; the default
 * gravity 0.2 × this factor = 0.08 wu/tick². The textbook range v²·sin(2θ)/g is then 64/0.08 =
 * 800 wu, and the integrator's own 60 Hz stepping lands it at 798 wu over 141 ticks — 2.35 s of
 * hang time, long enough to watch the wind work on the shell. `ballistics.test.ts` pins the span.
 *
 * (No reference footage was available; the numbers are calibrated to the documented target of
 * §5 — "a max-power 45° shot spans ≈ the field" — rather than measured off the original.)
 */
export const GRAVITY_UNIT_TO_WU_PER_TICK_SQUARED = 0.4;
export const POWER_TO_SPEED_WU_PER_TICK = 0.008;
/** The span the calibration above aims at, and the tolerance `ballistics.test.ts` allows it. */
export const CALIBRATION_TARGET_SPAN_WU = FIELD_WIDTH_WU;
export const CALIBRATION_SPAN_TOLERANCE_WU = 40;

/** [MANUAL §5] Wind magnitude range; the default cap on a round's random draw is 200. */
export const MIN_WIND = 0;
export const MAX_WIND = 500;
export const DEFAULT_MAX_WIND = 200;
/** §15.2 calibration: a 200-unit wind deflects a full-power 45° shot by about 100 wu. */
export const WIND_UNIT_TO_WU_PER_TICK_SQUARED = 0.00005;

/** [MANUAL §5] Air viscosity option range; 0 (off) is the default. */
export const MIN_VISCOSITY = 0;
export const MAX_VISCOSITY = 20;
export const DEFAULT_VISCOSITY = 0;
/** §15 default: each viscosity unit removes this fraction of the velocity every tick. */
export const VISCOSITY_DAMPING_PER_UNIT = 0.001;

/** [MANUAL §5] Shots leaving the field stay tracked for this margin before scoring a miss. */
export const BORDERS_EXTEND_MARGIN_WU = 75;

/** §15 default: how deep a tunnelling-enabled shell burrows before detonating. */
export const PROJECTILE_TUNNEL_DEPTH_WU = 6;

/** [MANUAL §5] Energy kept by a bounce, per wall material. */
export const PADDED_WALL_RESTITUTION = 0.5;
export const RUBBER_WALL_RESTITUTION = 1;
export const SPRING_WALL_RESTITUTION = 1.5;

/** Safety bound so a spring-walled shot can never loop forever. */
export const MAX_FLIGHT_TICKS = 30 * TICKS_PER_SECOND;

/** The wall modes a RANDOM or ERRATIC setting can resolve into. */
export const RESOLVABLE_WALL_MODES: readonly ResolvedWallMode[] = [
  'none',
  'concrete',
  'padded',
  'rubber',
  'spring',
  'wrap',
];

/** [MANUAL §7] Fuel buys 1 wu of level travel; climbing costs extra per wu of ascent. */
export const FUEL_COST_PER_WU = 1;
export const FUEL_EXTRA_COST_PER_WU_CLIMBED = 1;
/** §15 default: a tank cannot hold a slope steeper than this and slides down instead. */
export const MAX_CLIMB_SLOPE_WU_PER_COLUMN = 1.5;

export const MIN_TERRAIN_HEIGHT_WU = 10;
export const MAX_TERRAIN_HEIGHT_WU = 400;
export const TERRAIN_BASE_HEIGHT_WU = 150;
/** 2^10 + 1 = 1025 midpoint samples, resampled down onto the 800 columns. */
export const MIDPOINT_DISPLACEMENT_LEVELS = 10;
export const TERRAIN_ROUGHNESS_DECAY = 0.55;
export const MAX_TERRAIN_KNOB = 100;
const DEFAULT_BUMPINESS = 50;
const DEFAULT_SLOPE = 0;
const DEFAULT_FLATTEN_PEAKS = 0;
/** [MANUAL §10] Bumpiness drives the midpoint displacement amplitude. */
export const MAX_BUMPINESS_AMPLITUDE_WU = 220;
/** [MANUAL §10] Slope tilts the field; the knob is signed, negative tilts to the left. */
export const MAX_SLOPE_TILT_WU = 300;
/** [MANUAL §10] Flatten Peaks clamps the per-column step between these two limits. */
export const UNFLATTENED_MAX_STEP_WU_PER_COLUMN = 30;
export const FULLY_FLATTENED_MAX_STEP_WU_PER_COLUMN = 0.4;

/** §15.1 default: damage falls off linearly to zero at the blast radius. */
export const BLAST_DAMAGE_PER_RADIUS_WU = 1.5;

/** [MANUAL §8] Cash starts at zero and banks between rounds at 5% by default. */
export const DEFAULT_STARTING_CASH = 0;
export const MIN_INTEREST_PERCENT = 0;
export const MAX_INTEREST_PERCENT = 30;
export const DEFAULT_INTEREST_PERCENT = 5;
export const PERCENT_SCALE = 100;

/** [MANUAL §8] Inventories cap at 99 per item; a truncated final bundle costs 20% more. */
export const MAX_ITEM_COUNT = 99;
export const TRUNCATED_BUNDLE_MARKUP = 0.2;
/**
 * §15 default: selling returns 80% of the unit price. A full refund would let a player dump
 * their arsenal every round purely to earn bank interest on the proceeds and re-buy after.
 */
export const SELL_BACK_FRACTION = 0.8;

/** [MANUAL §6] Shop tier gate; the default exposes the whole catalog. */
export const MIN_ARMS_LEVEL = 0;
export const MAX_ARMS_LEVEL = 4;
export const DEFAULT_ARMS_LEVEL = MAX_ARMS_LEVEL;

/** [MANUAL §7] Auto Defense is armed before a round and priced by the rounds still to play. */
export const AUTO_DEFENSE_PRICE_PER_REMAINING_ROUND = 2000;

export const MIN_PLAYER_COUNT = 2;
export const MAX_PLAYER_COUNT = 10;
/** [MANUAL §8] A match is 10 rounds by default. */
export const MIN_ROUND_COUNT = 1;
export const MAX_ROUND_COUNT = 1000;
export const DEFAULT_ROUND_COUNT = 10;
/** A round runs while at least two tanks can still shoot at each other. */
export const MIN_TANKS_ALIVE_TO_CONTINUE = 2;

/** [MANUAL §7] Each battery restores 10 health, never past the 100 cap. */
export const BATTERY_HEALTH_BONUS = 10;

/** §15 default: how much damage each shield tier soaks before it collapses. */
export const SHIELD_CAPACITY_BY_TIER: Readonly<Record<ShieldTier, number>> = {
  shield: 100,
  force: 200,
  heavy: 400,
};

/**
 * §15.6, resolved at M4: a constant upward shove inside the radius, drawn from a per-round budget
 * counted in **tick-pushes** — one unit is spent for every tick a shell spends in the field.
 *
 * The acceleration is sized so one pass is decisive: a shell crossing the 60 wu bubble takes
 * roughly ten ticks, and a·t²/2 = 12 wu of lift over that pass is more than a tank is tall, so a
 * shot aimed dead-on arrives as a near miss. The capacity is then sized in whole passes — 30
 * buys about three deflections a round, 60 buys six for the Super Mag. Saturable, as the manual
 * insists, but no longer spent by the first shell that wanders past (the M3 budget of 6 ticks ran
 * out halfway through a single pass, which made the most expensive accessory in the shop a no-op).
 */
export const MAG_DEFLECTOR_RADIUS_WU = 60;
export const MAG_DEFLECTOR_ACCELERATION_WU_PER_TICK_SQUARED = 0.25;
export const MAG_DEFLECTOR_CAPACITY = 30;
export const SUPER_MAG_RADIUS_WU = 90;
export const SUPER_MAG_ACCELERATION_WU_PER_TICK_SQUARED = 0.4;
export const SUPER_MAG_CAPACITY = 60;

/** §15 default: heat guidance may bend the shell by this much every tick. */
export const HEAT_GUIDANCE_TURN_RATE_DEGREES_PER_TICK = 2;

/** [MANUAL §7] Contact Triggers are sold in bundles of 25 for $1 000. */
export const CONTACT_TRIGGER_COST = 1000;
export const CONTACT_TRIGGER_BUNDLE_SIZE = 25;

/**
 * §15.3, resolved at M4: three hops continuing along the impact trajectory with damped energy.
 *
 * A hop's range scales with the square of the damping, so the number is chosen from the distance
 * it produces rather than from how "lossy" it looks: at 0.35 a typical mid-power arrival hops
 * about 48 wu and a full-power one about 97 wu, against hop craters 40–60 wu across — the three
 * blasts chain into one advancing trench, which is the whole point of the weapon. (The M3 value
 * of 0.7 hopped 390 wu at full power: three "hops" crossed the entire field and read as three
 * unrelated shells.)
 */
export const LEAPFROG_HOP_COUNT = 3;
export const LEAPFROG_HOP_ENERGY_DAMPING = 0.35;

/** [MANUAL §6] MIRV-family warhead counts. */
export const MIRV_WARHEAD_COUNT = 5;
export const DEATHS_HEAD_WARHEAD_COUNT = 9;
/** §15 default: warheads fan out around the parent's velocity at apex. */
export const MIRV_WARHEAD_SPREAD_WU_PER_TICK = 0.6;

/**
 * §15.4, resolved at M4: 6–10 secondary bursts scattered along the ground around the impact.
 *
 * The scatter span is deliberately its own number rather than the weapon's [MANUAL] blast radius
 * the two happened to share at M3 — one describes how far the bomblets are thrown, the other how
 * big the parent crater is. 80 wu each way puts eight 40 wu craters over a 160 wu stretch: dense
 * enough to be a carpet rather than a shotgun pattern, and wide enough that a shooter who lobbed
 * it short is inside their own carpet, which is the self-risk the weapon is famous for.
 */
export const FUNKY_BOMB_MIN_BURSTS = 6;
export const FUNKY_BOMB_MAX_BURSTS = 10;
export const FUNKY_BOMB_BURST_RADIUS_WU = 20;
export const FUNKY_BOMB_SCATTER_HALF_SPAN_WU = 80;

/** §15 default: how wide a Dirt Charge throws its wedge of airborne dirt. */
export const DIRT_CHARGE_WEDGE_RADIUS_WU = 60;

/** A roller gives up after crossing this many columns without finding a resting place. */
export const ROLLER_MAX_TRAVEL_COLUMNS = 400;
/** How fast each roller crawls the surface; the heavy one takes its time on purpose. */
export const ROLLER_SPEED_WU_PER_TICK: Readonly<Partial<Record<WeaponId, number>>> = {
  'baby-roller': 1.8,
  roller: 1.5,
  'heavy-roller': 1,
};
export const DEFAULT_ROLLER_SPEED_WU_PER_TICK = 1.5;

/**
 * The falling-sand settle's gravity, in wu per tick². Not the §5 shell gravity: this paces both
 * the GPU descent animation and the round's own settling wait — nobody may fire while the ground
 * is still coming down, so the animation and the turn gate must count the same ticks.
 */
export const COLLAPSE_GRAVITY_WU_PER_TICK_SQUARED = 0.028;
/** Ticks added to the estimated descent so a rounding error can never freeze dirt mid-air. */
export const COLLAPSE_SETTLE_MARGIN_TICKS = 8;
/** A rise steeper than this per column is a wall — the roller detonates at its base. */
export const ROLLER_MAX_CLIMB_WU_PER_COLUMN = 3;
/** A shield stops the roller at arm's length: it detonates this far outside the tank's box. */
export const ROLLER_SHIELD_STANDOFF_WU = 3;

/** §15.5 defaults for napalm spread; the coating depth drives the per-turn burn damage. */
export const NAPALM_DAMAGE_PER_DEPTH_WU = 2;
export const NAPALM_MAX_POOL_HALF_SPAN_COLUMNS = 60;
export const NAPALM_SURFACE_DEPTH_WU = 4;
export const NAPALM_MAX_CLIMB_WU_PER_COLUMN = 3;

/** §15 default: how far liquid dirt spreads while looking for hollows to fill. */
export const LIQUID_DIRT_MAX_HALF_SPAN_COLUMNS = 80;

export const LIQUID_DIRT_POUR_PORTIONS = 14;

export const LIQUID_DIRT_POUR_INTERVAL_TICKS = 4;

/** [MANUAL §6] Plasma radius scales with the batteries spent on the shot. */
/** Worth its price even dry: the batteryless blast already outreaches a Missile. */
export const PLASMA_MIN_RADIUS_WU = 25;
export const PLASMA_MAX_RADIUS_WU = 75;
export const PLASMA_MIN_BATTERIES = 1;
export const PLASMA_MAX_BATTERIES = 10;

/** §15 default: the laser cuts a thin line and ignores both terrain and shields. */
export const LASER_DAMAGE = 30;
export const LASER_BEAM_HALF_WIDTH_WU = 3;

/** [MANUAL §8] STANDARD scoring: damage scores continuously, kills add a bonus. */
export const STANDARD_POINTS_PER_DAMAGE = 1;
export const STANDARD_KILL_POINTS = 100;
/** Self and team damage is subtracted rather than ignored. */
export const SELF_DAMAGE_POINTS_MULTIPLIER = -1;
/** §15 default: round winnings are the round's points at this rate. */
export const CASH_PER_POINT = 100;

/** How many wind/gravity refinement passes the solver runs before accepting its answer. */
export const AIM_SOLVER_REFINEMENT_PASSES = 8;
export const AIM_SOLVER_PREFERRED_ELEVATION_DEGREES = 45;
export const AIM_SOLVER_SCAN_STEP_DEGREES = 5;
/** A simulated shot counts as a hit once it lands this close to the target. */
export const AIM_HIT_TOLERANCE_WU = 12;
/** Mirror images considered per side when Poolshark looks for a bank shot. */
export const BANK_SHOT_MIRROR_COUNT = 2;
/** §15 default: Tosser moves this fraction of the way towards closing its previous miss. */
export const TOSSER_REFINEMENT_GAIN = 0.5;

/** [MANUAL §12] Talking tanks: the per-shot chance of a taunt, off by default. */
export const MIN_TALK_PROBABILITY_PERCENT = 0;
export const MAX_TALK_PROBABILITY_PERCENT = 100;
export const DEFAULT_TALK_PROBABILITY_PERCENT = 0;

/**
 * §13 "feel": an AI must not snap onto its answer. It pauses as if considering the shot, then
 * winds the dial and the throttle across at a human-ish rate before pulling the trigger.
 */
/**
 * How many taunt lines of each kind the translations carry. The store picks an index rather than
 * a string — the lines are translated text, which the application layer must never reach into —
 * so both languages have to supply exactly this many, which a translation test pins.
 */
export const TAUNT_LINE_COUNT = 10;
/** How long a speech bubble stays over a tank before it fades. */
export const TAUNT_VISIBLE_SECONDS = 2.6;
/** How long a floating damage number stays at the point of impact (§13). */
export const DAMAGE_POPUP_SECONDS = 1.4;

export const AI_THINKING_SECONDS = 0.7;
export const AI_DIAL_DEGREES_PER_SECOND = 120;
export const AI_POWER_UNITS_PER_SECOND = 1100;
/** Below this the dial has arrived; anything finer would never converge in floating point. */
export const AI_AIM_EPSILON = 0.001;

/** §15 default: the AI spends at most this share of its bank in one shop visit. */
export const AI_SHOPPING_BUDGET_FRACTION = 0.8;
export const AI_MAX_SHOP_PURCHASES = 12;
/** Spent on defence before the weapon rack gets the rest. */
export const AI_DEFENSE_BUDGET_FRACTION = 0.4;
/** Auto Defense is priced by the rounds left, so late in the match it stops being worth it. */
export const AI_MIN_ROUNDS_FOR_AUTO_DEFENSE = 2;
export const AI_SHIELD_STOCK_TARGET = 3;

/** §12.2: the ghost shows the first 1.5 s of flight, sampled every few ticks. */
export const GHOST_TRAJECTORY_SECONDS = 1.5;
export const GHOST_TRAJECTORY_SAMPLE_STRIDE_TICKS = 3;

/** [MANUAL §5] The purist defaults the Advanced panel opens with. */
export const DEFAULT_PHYSICS_OPTIONS: PhysicsOptions = {
  gravity: DEFAULT_GRAVITY,
  maxWind: DEFAULT_MAX_WIND,
  isWindChanging: false,
  viscosity: DEFAULT_VISCOSITY,
  wallMode: 'none',
  isBordersExtendEnabled: true,
  isTunnelingEnabled: true,
  areTankFallsEnabled: true,
};

export const DEFAULT_TERRAIN_OPTIONS: TerrainOptions = {
  bumpiness: DEFAULT_BUMPINESS,
  slope: DEFAULT_SLOPE,
  flattenPeaks: DEFAULT_FLATTEN_PEAKS,
};
