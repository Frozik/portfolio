import { assertNever } from '@frozik/utils/assert/assertNever';
import type { IMutedStorage } from '@frozik/utils/storage/mutedStorage';
import { createMutedStorage } from '@frozik/utils/storage/mutedStorage';
import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import { ENEMIES_PER_STAGE, INITIAL_LIVES, TICKS_PER_SECOND } from '../domain/constants';
import type { WorldEvent } from '../domain/types';
import { TanksWorld } from '../domain/world';
import type { IBestScoreStorage } from '../infrastructure/best-score-storage';
import { createBestScoreStorage } from '../infrastructure/best-score-storage';
import type { IInputSource } from '../infrastructure/key-state-source';
import { TanksWorldRef } from '../infrastructure/tanks-world-ref';
import type { ITouchControlInput } from '../infrastructure/touch-control-source';
import { TouchControlSource } from '../infrastructure/touch-control-source';

export type TanksGameStatus =
  | 'menu'
  | 'stage-intro'
  | 'playing'
  | 'paused'
  | 'stage-clear'
  | 'game-over';

export interface IStageSummary {
  readonly stageNumber: number;
  readonly enemiesDestroyed: number;
  readonly points: number;
}

const STAGE_INTRO_DURATION_MS = 2000;
const STAGE_CLEAR_DURATION_MS = 2500;

const MS_PER_TICK = 1000 / TICKS_PER_SECOND;
/** §11.5: "GAME OVER" climbs the field for 128 ticks, then holds for 144. */
const GAME_OVER_RISE_TICKS = 128;
const GAME_OVER_HOLD_TICKS = 144;
const GAME_OVER_DURATION_MS = (GAME_OVER_RISE_TICKS + GAME_OVER_HOLD_TICKS) * MS_PER_TICK;

const MUTED_STORAGE_KEY = 'tanks:muted';

const NO_SCORE = 0;
const FIRST_STAGE_NUMBER = 1;

export class TanksStore {
  gameStatus: TanksGameStatus = 'menu';
  stageNumber = FIRST_STAGE_NUMBER;
  score = NO_SCORE;
  bestScore: number;
  lives = INITIAL_LIVES;
  enemiesRemaining = ENEMIES_PER_STAGE;
  stageSummary: IStageSummary | undefined;
  isMuted: boolean;
  fps = 0;

  readonly worldRef = new TanksWorldRef(new TanksWorld());

  private readonly bestScoreStorage: IBestScoreStorage;
  private readonly mutedStorage: IMutedStorage;
  private readonly touchSource = new TouchControlSource();
  private flowTimeoutId: number | undefined;
  private persistedBestScore: number;
  private stageEnemiesDestroyed = 0;
  private stagePoints = 0;

  constructor(
    bestScoreStorage: IBestScoreStorage = createBestScoreStorage(),
    mutedStorage: IMutedStorage = createMutedStorage(MUTED_STORAGE_KEY)
  ) {
    this.bestScoreStorage = bestScoreStorage;
    this.bestScore = bestScoreStorage.read();
    this.persistedBestScore = this.bestScore;
    this.mutedStorage = mutedStorage;
    this.isMuted = mutedStorage.read();

    makeAutoObservable<
      TanksStore,
      | 'bestScoreStorage'
      | 'mutedStorage'
      | 'touchSource'
      | 'flowTimeoutId'
      | 'persistedBestScore'
      | 'stageEnemiesDestroyed'
      | 'stagePoints'
    >(
      this,
      {
        worldRef: false,
        bestScoreStorage: false,
        mutedStorage: false,
        touchSource: false,
        flowTimeoutId: false,
        persistedBestScore: false,
        stageEnemiesDestroyed: false,
        stagePoints: false,
      },
      { autoBind: true }
    );

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  get isPlaying(): boolean {
    return this.gameStatus === 'playing';
  }

  get touchControls(): ITouchControlInput {
    return this.touchSource;
  }

  get touchInput(): IInputSource {
    return this.touchSource;
  }

  startGame(): void {
    if (this.gameStatus !== 'menu') {
      return;
    }

    this.resetRun();
    this.beginStageIntro();
  }

  skipStageIntro(): void {
    if (this.gameStatus !== 'stage-intro') {
      return;
    }

    this.clearFlowTimeout();
    this.gameStatus = 'playing';
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    this.mutedStorage.write(this.isMuted);
  }

  togglePause(): void {
    switch (this.gameStatus) {
      case 'playing':
        this.gameStatus = 'paused';
        break;
      case 'paused':
        this.gameStatus = 'playing';
        break;
      case 'menu':
      case 'stage-intro':
      case 'stage-clear':
      case 'game-over':
        break;
      default:
        assertNever(this.gameStatus);
    }
  }

  returnToMenu(): void {
    this.clearFlowTimeout();
    this.resetRun();
    this.gameStatus = 'menu';
  }

  applyWorldEvents(events: readonly WorldEvent[]): void {
    let isGameOver = false;
    let isStageCleared = false;
    let latestTotalScore: number | undefined;

    for (const event of events) {
      switch (event.type) {
        case 'enemy-destroyed':
          this.stageEnemiesDestroyed++;
          break;
        case 'score-awarded':
          this.stagePoints += event.points;
          latestTotalScore = event.totalScore;
          break;
        case 'stage-cleared':
          isStageCleared = true;
          break;
        case 'game-over':
          isGameOver = true;
          break;
        default:
          break;
      }
    }

    this.syncHudFromWorld(latestTotalScore);

    if (isGameOver) {
      this.endRun();

      return;
    }

    if (isStageCleared) {
      this.beginStageClear();
    }
  }

  setFps(fps: number): void {
    this.fps = fps;
  }

  /** A hidden tab must never lose the game — the render loop's delta clamp alone would still advance it. */
  handleVisibilityChange(): void {
    if (!document.hidden) {
      return;
    }

    if (this.gameStatus === 'playing') {
      this.gameStatus = 'paused';
    }
  }

  dispose(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.clearFlowTimeout();
    this.persistBestScore();
    this.touchSource.dispose();
  }

  private resetRun(): void {
    this.worldRef.replace(new TanksWorld());
    this.touchSource.release();
    this.stageEnemiesDestroyed = 0;
    this.stagePoints = 0;
    this.stageNumber = FIRST_STAGE_NUMBER;
    this.score = NO_SCORE;
    this.lives = INITIAL_LIVES;
    this.enemiesRemaining = ENEMIES_PER_STAGE;
    this.stageSummary = undefined;
  }

  private beginStageIntro(): void {
    this.gameStatus = 'stage-intro';
    this.scheduleFlowStep(STAGE_INTRO_DURATION_MS, this.skipStageIntro);
  }

  private beginStageClear(): void {
    this.gameStatus = 'stage-clear';
    this.stageSummary = {
      stageNumber: this.stageNumber,
      enemiesDestroyed: this.stageEnemiesDestroyed,
      points: this.stagePoints,
    };
    this.persistBestScore();
    this.scheduleFlowStep(STAGE_CLEAR_DURATION_MS, this.advanceToNextStage);
  }

  private advanceToNextStage(): void {
    const world = this.worldRef.current;

    // The world can leave `stage-cleared` between the summary appearing and this firing — a base
    // blown up in the very tick the last enemy died ends the run instead of clearing the stage.
    if (world.status === 'stage-cleared') {
      world.advanceToNextStage();
    }

    this.stageEnemiesDestroyed = 0;
    this.stagePoints = 0;
    this.stageSummary = undefined;
    this.syncHudFromWorld();
    this.beginStageIntro();
  }

  private endRun(): void {
    this.clearFlowTimeout();
    this.gameStatus = 'game-over';
    this.persistBestScore();
    this.scheduleFlowStep(GAME_OVER_DURATION_MS, this.returnToMenu);
  }

  private syncHudFromWorld(latestTotalScore?: number): void {
    const world = this.worldRef.current;

    if (!isNil(latestTotalScore)) {
      this.score = latestTotalScore;
      this.bestScore = Math.max(this.bestScore, latestTotalScore);
    }

    this.stageNumber = world.stageNumber;
    this.lives = world.lives;
    this.enemiesRemaining = world.enemiesRemaining;
  }

  private persistBestScore(): void {
    if (this.bestScore <= this.persistedBestScore) {
      return;
    }

    this.persistedBestScore = this.bestScore;
    this.bestScoreStorage.write(this.bestScore);
  }

  private scheduleFlowStep(delayMs: number, step: VoidFunction): void {
    this.clearFlowTimeout();
    this.flowTimeoutId = window.setTimeout(step, delayMs);
  }

  private clearFlowTimeout(): void {
    if (isNil(this.flowTimeoutId)) {
      return;
    }

    window.clearTimeout(this.flowTimeoutId);
    this.flowTimeoutId = undefined;
  }
}
