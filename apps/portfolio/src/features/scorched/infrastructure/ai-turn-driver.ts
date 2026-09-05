import type { Vector2 } from '@frozik/utils/math/vector2';
import { clamp } from 'lodash-es';
import { selectAiWeapon } from '../domain/ai/loadout';
import type { AiContext, AiTankView, DisclosedPersonality } from '../domain/ai/personalities';
import { decideAim, resolveUnknownPersonality, selectTarget } from '../domain/ai/personalities';
import { fromDialDegrees, toDialDegrees } from '../domain/aim-dial';
import { createEnvironment, getMaxPower } from '../domain/ballistics';
import {
  AI_AIM_EPSILON,
  AI_DIAL_DEGREES_PER_SECOND,
  AI_POWER_UNITS_PER_SECOND,
  AI_THINKING_SECONDS,
  TANK_CENTER_OFFSET_WU,
} from '../domain/constants';
import { selectBestShieldItem } from '../domain/items/behaviors';
import type { ScorchedRound } from '../domain/round';
import type { AimState, AiPersonality, ItemId, PlayerId, WeaponId } from '../domain/types';

/** What the store should do with the AI's turn this frame. */
export interface AiTurnStep {
  /** True during the pause before the barrel starts moving — the "thinking" beat. */
  readonly isThinking: boolean;
  readonly aim: AimState | undefined;
  readonly weaponId: WeaponId | undefined;
  /** [MANUAL §7] A bubble to put up before aiming; reported once per turn, never twice. */
  readonly shieldItemId: ItemId | undefined;
  readonly isFireRequested: boolean;
}

export interface AiTurnRequest {
  readonly round: ScorchedRound;
  readonly personality: AiPersonality;
  readonly killsByPlayerId: ReadonlyMap<PlayerId, number>;
  readonly elapsedSeconds: number;
}

interface ShotMemory {
  readonly aim: AimState;
  readonly targetId: PlayerId;
  readonly impact: Vector2;
}

interface PendingShot {
  readonly playerId: PlayerId;
  readonly aim: AimState;
  readonly targetId: PlayerId;
}

const IDLE_STEP: AiTurnStep = {
  isThinking: false,
  aim: undefined,
  weaponId: undefined,
  shieldItemId: undefined,
  isFireRequested: false,
};

/** Winds the dial and the throttle towards the answer at a fixed rate rather than snapping. */
export function stepAimTowards(
  current: AimState,
  target: AimState,
  elapsedSeconds: number
): AimState {
  const maxDialStep = AI_DIAL_DEGREES_PER_SECOND * elapsedSeconds;
  const maxPowerStep = AI_POWER_UNITS_PER_SECOND * elapsedSeconds;
  const dialDegrees =
    toDialDegrees(current) +
    clamp(toDialDegrees(target) - toDialDegrees(current), -maxDialStep, maxDialStep);

  return {
    ...fromDialDegrees(dialDegrees),
    power: current.power + clamp(target.power - current.power, -maxPowerStep, maxPowerStep),
  };
}

export function hasReachedAim(current: AimState, target: AimState): boolean {
  return (
    Math.abs(toDialDegrees(current) - toDialDegrees(target)) <= AI_AIM_EPSILON &&
    Math.abs(current.power - target.power) <= AI_AIM_EPSILON
  );
}

/**
 * Plays an AI's turn on the frame clock: it thinks for a beat, dials the barrel across
 * where the player can watch it happen, and only then pulls the trigger. The decision itself is
 * the domain's — this only paces it and remembers the two things the manual's personalities need
 * across shots: where their last shell landed, and who last hurt them.
 */
export class AiTurnDriver {
  private readonly disclosedByPlayerId = new Map<PlayerId, DisclosedPersonality>();
  private readonly shotMemoryByPlayerId = new Map<PlayerId, ShotMemory>();
  private readonly lastAttackerByPlayerId = new Map<PlayerId, PlayerId>();
  private pendingShot: PendingShot | undefined;
  private plannedPlayerId: PlayerId | undefined;
  private targetAim: AimState | undefined;
  private plannedWeaponId: WeaponId | undefined;
  private plannedShieldItemId: ItemId | undefined;
  private thinkingSecondsRemaining = 0;

  advance(request: AiTurnRequest): AiTurnStep {
    const { round, elapsedSeconds } = request;
    const playerId = round.activePlayerId;
    const tank = playerId === undefined ? undefined : round.getTank(playerId);

    if (playerId === undefined || tank === undefined || round.phase !== 'aiming') {
      return IDLE_STEP;
    }

    if (this.plannedPlayerId !== playerId || this.targetAim === undefined) {
      this.plan(request, playerId);
    }

    const targetAim = this.targetAim;

    if (targetAim === undefined) {
      return IDLE_STEP;
    }

    if (this.thinkingSecondsRemaining > 0) {
      this.thinkingSecondsRemaining -= elapsedSeconds;

      return {
        isThinking: true,
        aim: undefined,
        weaponId: undefined,
        shieldItemId: this.takePlannedShield(),
        isFireRequested: false,
      };
    }

    const aim = stepAimTowards(tank.aim, targetAim, elapsedSeconds);
    const isReady = hasReachedAim(aim, targetAim);

    if (isReady) {
      this.plannedPlayerId = undefined;
      this.targetAim = undefined;
    }

    return {
      isThinking: false,
      aim: isReady ? targetAim : aim,
      weaponId: this.plannedWeaponId,
      shieldItemId: this.takePlannedShield(),
      isFireRequested: isReady,
    };
  }

  /** The plan names a bubble once; handing it out twice would spend two of them in one turn. */
  private takePlannedShield(): ItemId | undefined {
    const itemId = this.plannedShieldItemId;

    this.plannedShieldItemId = undefined;

    return itemId;
  }

  /** The first thing the shot hit is what the Tosser walks its next attempt in from. */
  recordImpact(impact: Vector2): void {
    const shot = this.pendingShot;

    if (shot === undefined) {
      return;
    }

    this.pendingShot = undefined;
    this.shotMemoryByPlayerId.set(shot.playerId, {
      aim: shot.aim,
      targetId: shot.targetId,
      impact,
    });
  }

  /** [MANUAL §9] Cyborg holds a grudge, so every hit is remembered by its victim. */
  recordAttack(playerId: PlayerId, attackerId: PlayerId | undefined): void {
    if (attackerId !== undefined && attackerId !== playerId) {
      this.lastAttackerByPlayerId.set(playerId, attackerId);
    }
  }

  reset(): void {
    this.disclosedByPlayerId.clear();
    this.shotMemoryByPlayerId.clear();
    this.lastAttackerByPlayerId.clear();
    this.pendingShot = undefined;
    this.plannedPlayerId = undefined;
    this.targetAim = undefined;
    this.plannedWeaponId = undefined;
    this.plannedShieldItemId = undefined;
    this.thinkingSecondsRemaining = 0;
  }

  /**
   * [MANUAL §9] An Unknown opponent is secretly one of the others for the whole match, not a
   * fresh draw every shot — otherwise "unknown" would just be a second Moron.
   */
  private resolveDisclosed(playerId: PlayerId, personality: AiPersonality): DisclosedPersonality {
    if (personality !== 'unknown') {
      return personality;
    }

    const cached = this.disclosedByPlayerId.get(playerId);

    if (cached !== undefined) {
      return cached;
    }

    const resolved = resolveUnknownPersonality();

    this.disclosedByPlayerId.set(playerId, resolved);

    return resolved;
  }

  private plan(request: AiTurnRequest, playerId: PlayerId): void {
    const { round, personality, killsByPlayerId } = request;
    const disclosed = this.resolveDisclosed(playerId, personality);
    const context = this.createContext(round, playerId, killsByPlayerId);
    const target = selectTarget(disclosed, context);

    this.plannedPlayerId = playerId;
    this.thinkingSecondsRemaining = AI_THINKING_SECONDS;
    this.targetAim = decideAim(disclosed, context);
    this.plannedWeaponId = selectAiWeapon(weaponId => round.getAmmoCount(playerId, weaponId));
    // [MANUAL §7] An AI that owns a bubble and is standing bare puts its best one up first.
    this.plannedShieldItemId =
      round.getTank(playerId)?.shield === undefined
        ? selectBestShieldItem(itemId => round.getItemCount(playerId, itemId))
        : undefined;
    this.pendingShot =
      target === undefined
        ? undefined
        : { playerId, aim: this.targetAim, targetId: target.playerId };
  }

  private createContext(
    round: ScorchedRound,
    playerId: PlayerId,
    killsByPlayerId: ReadonlyMap<PlayerId, number>
  ): AiContext {
    const views = round.tanks
      .filter(tank => tank.isAlive)
      .map<AiTankView>(tank => ({
        playerId: tank.playerId,
        position: { x: tank.columnIndex + 0.5, y: tank.positionY + TANK_CENTER_OFFSET_WU },
        health: tank.health,
        kills: killsByPlayerId.get(tank.playerId) ?? 0,
      }));
    const self = views.find(view => view.playerId === playerId);
    const health = round.getTank(playerId)?.health ?? 0;

    return {
      self: self ?? { playerId, position: { x: 0, y: 0 }, health, kills: 0 },
      opponents: views.filter(view => view.playerId !== playerId),
      environment: createEnvironment(
        round.physics,
        round.windUnits,
        round.resolvedWallMode,
        round.field.length
      ),
      field: round.field,
      maxPower: getMaxPower(health),
      previousShot: this.shotMemoryByPlayerId.get(playerId),
      lastAttackerId: this.lastAttackerByPlayerId.get(playerId),
    };
  }
}
