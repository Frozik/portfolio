import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { PlayerId, WorldEvent } from '../domain/types';
import { AiTurnDriver } from '../infrastructure/ai-turn-driver';
import type { AimModel } from './AimModel';
import type { WorldModel } from './WorldModel';

export interface IAiTurnModelParams {
  readonly world: WorldModel;
  readonly aim: AimModel;
  /** True while an AI is lining up its shot — the only time this model does anything. */
  readonly isAiAiming: () => boolean;
  /** Events an AI's mid-turn action produced, for the renderer's single funnel. */
  readonly queueEvents: (events: readonly WorldEvent[]) => void;
  readonly fire: () => readonly WorldEvent[];
}

const NO_EVENTS: readonly WorldEvent[] = [];

/** Plays the AI players' turns on the frame clock: a thinking beat, the barrel winding across, the shot. */
export class AiTurnModel {
  thinkingPlayerId: PlayerId | undefined;

  private readonly driver = new AiTurnDriver();
  private readonly world: WorldModel;
  private readonly aim: AimModel;
  private readonly isAiAiming: () => boolean;
  private readonly queueEvents: (events: readonly WorldEvent[]) => void;
  private readonly fire: () => readonly WorldEvent[];

  constructor(params: IAiTurnModelParams) {
    this.world = params.world;
    this.aim = params.aim;
    this.isAiAiming = params.isAiAiming;
    this.queueEvents = params.queueEvents;
    this.fire = params.fire;

    makeAutoObservable<
      AiTurnModel,
      'driver' | 'world' | 'aim' | 'isAiAiming' | 'queueEvents' | 'fire'
    >(
      this,
      {
        driver: false,
        world: false,
        aim: false,
        isAiAiming: false,
        queueEvents: false,
        fire: false,
      },
      { autoBind: true }
    );
  }

  advance(elapsedSeconds: number): readonly WorldEvent[] {
    const activePlayer = this.world.activePlayer;

    if (!this.isAiAiming() || isNil(activePlayer) || activePlayer.controller.kind !== 'ai') {
      this.thinkingPlayerId = undefined;

      return NO_EVENTS;
    }

    const step = this.driver.advance({
      round: this.world.round,
      personality: activePlayer.controller.personality,
      killsByPlayerId: new Map(this.world.match.players.map(player => [player.id, player.kills])),
      elapsedSeconds,
    });

    this.thinkingPlayerId = step.isThinking ? activePlayer.id : undefined;

    if (!isNil(step.shieldItemId)) {
      // Copied out because the round reuses its event array: the same turn's shot would clear it.
      this.queueEvents([...this.world.round.raiseShield(step.shieldItemId)]);
    }

    if (!isNil(step.weaponId)) {
      this.aim.selectWeapon(step.weaponId);
    }

    if (!isNil(step.aim)) {
      this.aim.setAim(step.aim);
    }

    return step.isFireRequested ? this.fire() : NO_EVENTS;
  }

  /**
   * What the AIs learn from the round: [MANUAL §9] Cyborg holds a grudge, so
   * every hit is remembered by its victim, and Tosser walks its shots in from
   * where the last one landed.
   */
  applyEvents(events: readonly WorldEvent[]): void {
    for (const event of events) {
      if (event.type === 'tank-damaged') {
        this.driver.recordAttack(event.playerId, event.sourceId);
      } else if (event.type === 'projectile-ended') {
        this.driver.recordImpact(event.position);
      }
    }
  }

  endRound(): void {
    this.thinkingPlayerId = undefined;
  }

  reset(): void {
    this.driver.reset();
    this.thinkingPlayerId = undefined;
  }
}
