import { assert } from '@frozik/utils/assert/assert';

import { ENEMIES_PER_STAGE, STAGE_COUNT } from './constants';
import { stepWorldBullets } from './simulation/bullets-step';
import { stepEnemies } from './simulation/enemies-step';
import { stepPlayers } from './simulation/players-step';
import { collectPowerUp } from './simulation/power-ups-step';
import { stepSpawning } from './simulation/spawning-step';
import { stepTimers } from './simulation/timers-step';
import type { GameStatus, WorldState } from './simulation/world-state';
import { beginStage, createWorldState } from './simulation/world-state';
import type { Terrain } from './terrain';
import type { Bullet, EnemyTank, PlayerInputs, PlayerTank, PowerUpDrop, WorldEvent } from './types';

const FIRST_STAGE_NUMBER = 1;

function resolveStageCompletion(state: WorldState, events: WorldEvent[]): void {
  if (state.stage.spawner.hasPendingEnemies || state.stage.enemies.length > 0) {
    return;
  }

  state.status = 'stage-cleared';
  events.push({ type: 'stage-cleared', stageNumber: state.stage.definition.stageNumber });
}

/** The simulation's public face: owns the state, runs the fixed-step tick, reports its events. */
export class TanksWorld {
  /** Reused between ticks — consumers must read it before calling `tick` again. */
  private readonly events: WorldEvent[] = [];
  private readonly state: WorldState;

  constructor(options: { readonly stageNumber?: number } = {}) {
    this.state = createWorldState(options.stageNumber);
  }

  get status(): GameStatus {
    return this.state.status;
  }

  get stageNumber(): number {
    return this.state.stage.definition.stageNumber;
  }

  get loop(): number {
    return this.state.loopNumber;
  }

  get score(): number {
    return this.state.score;
  }

  get lives(): number {
    return this.state.lives;
  }

  /** Enemies of this stage that are still alive or still waiting to spawn — the HUD icons. */
  get enemiesRemaining(): number {
    return (
      ENEMIES_PER_STAGE - this.state.stage.spawner.spawnedCount + this.state.stage.enemies.length
    );
  }

  get ticksSinceStageStart(): number {
    return this.state.stage.ticks;
  }

  get terrain(): Terrain {
    return this.state.stage.terrain;
  }

  get players(): readonly PlayerTank[] {
    return this.state.players;
  }

  get enemies(): readonly EnemyTank[] {
    return this.state.stage.enemies;
  }

  get bullets(): readonly Bullet[] {
    return this.state.stage.bullets;
  }

  get powerUp(): PowerUpDrop | undefined {
    return this.state.stage.powerUp;
  }

  get isBaseDestroyed(): boolean {
    return this.state.isBaseDestroyed;
  }

  get isEnemyFreezeActive(): boolean {
    return this.state.stage.freezeTicksRemaining > 0;
  }

  tick(inputs: PlayerInputs): readonly WorldEvent[] {
    const { state, events } = this;

    events.length = 0;

    if (state.stage.isStartPending) {
      events.push({ type: 'stage-started', stageNumber: state.stage.definition.stageNumber });
      state.stage.isStartPending = false;
    }

    if (state.status !== 'playing') {
      return events;
    }

    stepTimers(state);
    stepSpawning(state, events);
    stepPlayers(state, inputs, events);
    stepEnemies(state, events);
    stepWorldBullets(state, events);
    collectPowerUp(state, events);
    resolveStageCompletion(state, events);
    state.stage.ticks++;

    return events;
  }

  advanceToNextStage(): void {
    const { state } = this;

    assert(state.status === 'stage-cleared', 'the stage is not cleared yet');

    const isLastStage = state.stage.definition.stageNumber >= STAGE_COUNT;

    if (isLastStage) {
      state.loopNumber++;
    }

    beginStage(state, isLastStage ? FIRST_STAGE_NUMBER : state.stage.definition.stageNumber + 1);
  }
}
