import {
  DEFAULT_ARMS_LEVEL,
  DEFAULT_GRAVITY,
  DEFAULT_INTEREST_PERCENT,
  DEFAULT_MAX_WIND,
  DEFAULT_ROUND_COUNT,
  DEFAULT_STARTING_CASH,
  DEFAULT_TALK_PROBABILITY_PERCENT,
  DEFAULT_TERRAIN_OPTIONS,
  DEFAULT_VISCOSITY,
  MIN_WIND,
} from '../domain/constants';
import type {
  MatchOptions,
  PhysicsOptions,
  PlayerSetup,
  PlayOrder,
  WallMode,
} from '../domain/types';

/** The three wind choices the curated options row offers instead of a magnitude slider. */
export type WindPreset = 'off' | 'steady' | 'changing';

/** The three walls choices; the remaining [MANUAL §5] modes stay out of the curated row. */
export type WallsPreset = 'none' | 'bouncy' | 'wrap';

/** Everything behind the single collapsed Advanced panel, at the manual's own defaults. */
export interface ScorchedAdvancedOptions {
  readonly gravity: number;
  readonly viscosity: number;
  readonly isBordersExtendEnabled: boolean;
  readonly isTunnelingEnabled: boolean;
  readonly areTankFallsEnabled: boolean;
  readonly playOrder: PlayOrder;
  readonly talkProbabilityPercent: number;
  readonly armsLevel: number;
  readonly interestPercent: number;
  /**
   * [MANUAL §5] The full eight-mode walls setting. Undefined leaves the curated Walls row in
   * charge; naming a mode here overrides it, which is how the five modes the row deliberately
   * hides — concrete, padded, spring, random and erratic — are reachable at all.
   */
  readonly wallMode: WallMode | undefined;
}

export interface ScorchedSetupOptions {
  readonly roundCount: number;
  readonly wind: WindPreset;
  readonly walls: WallsPreset;
  readonly startingCash: number;
  readonly advanced: ScorchedAdvancedOptions;
}

export const DEFAULT_ADVANCED_OPTIONS: ScorchedAdvancedOptions = {
  gravity: DEFAULT_GRAVITY,
  viscosity: DEFAULT_VISCOSITY,
  isBordersExtendEnabled: true,
  isTunnelingEnabled: true,
  areTankFallsEnabled: true,
  playOrder: 'sequential',
  talkProbabilityPercent: DEFAULT_TALK_PROBABILITY_PERCENT,
  armsLevel: DEFAULT_ARMS_LEVEL,
  interestPercent: DEFAULT_INTEREST_PERCENT,
  wallMode: undefined,
};

export const DEFAULT_SETUP_OPTIONS: ScorchedSetupOptions = {
  roundCount: DEFAULT_ROUND_COUNT,
  wind: 'steady',
  walls: 'none',
  startingCash: DEFAULT_STARTING_CASH,
  advanced: DEFAULT_ADVANCED_OPTIONS,
};

const WALL_MODE_BY_PRESET: Readonly<Record<WallsPreset, WallMode>> = {
  none: 'none',
  bouncy: 'rubber',
  wrap: 'wrap',
};

function createPhysicsOptions(options: ScorchedSetupOptions): PhysicsOptions {
  const { advanced } = options;

  return {
    gravity: advanced.gravity,
    maxWind: options.wind === 'off' ? MIN_WIND : DEFAULT_MAX_WIND,
    isWindChanging: options.wind === 'changing',
    viscosity: advanced.viscosity,
    wallMode: advanced.wallMode ?? WALL_MODE_BY_PRESET[options.walls],
    isBordersExtendEnabled: advanced.isBordersExtendEnabled,
    isTunnelingEnabled: advanced.isTunnelingEnabled,
    areTankFallsEnabled: advanced.areTankFallsEnabled,
  };
}

/** Folds the roster screen's two tiers of choices back into the domain's one options record. */
export function createMatchOptions(
  players: readonly PlayerSetup[],
  options: ScorchedSetupOptions
): MatchOptions {
  return {
    players,
    roundCount: options.roundCount,
    startingCash: options.startingCash,
    interestPercent: options.advanced.interestPercent,
    armsLevel: options.advanced.armsLevel,
    playOrder: options.advanced.playOrder,
    physics: createPhysicsOptions(options),
    terrain: DEFAULT_TERRAIN_OPTIONS,
  };
}
