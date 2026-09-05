import { assertNever } from '@frozik/utils/assert/assertNever';
import type { IMutedStorage } from '@frozik/utils/storage/mutedStorage';
import { createMutedStorage } from '@frozik/utils/storage/mutedStorage';
import { isNil } from 'lodash-es';
import { createAtom, makeAutoObservable } from 'mobx';

import { TICKS_PER_SECOND } from '../domain/constants';
import type { IBestScoreStorage } from '../domain/ports/best-score-storage';
import type { IInputSource } from '../domain/ports/input-source';
import type { ITouchControlInput } from '../domain/ports/touch-control-input';
import type { IVisibilitySource } from '../domain/ports/visibility-source';
import type { WorldEvent } from '../domain/types';
import { TanksWorld } from '../domain/world';
import { createBestScoreStorage } from '../infrastructure/best-score-storage';
import { createDocumentVisibilitySource } from '../infrastructure/document-visibility-source';
import { TanksWorldRef } from '../infrastructure/tanks-world-ref';
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
/** "GAME OVER" climbs the field for 128 ticks, then holds for 144. */
const GAME_OVER_RISE_TICKS = 128;
const GAME_OVER_HOLD_TICKS = 144;
const GAME_OVER_DURATION_MS = (GAME_OVER_RISE_TICKS + GAME_OVER_HOLD_TICKS) * MS_PER_TICK;

const MUTED_STORAGE_KEY = 'tanks:muted';

const NO_SCORE = 0;

export class TanksStore {
  gameStatus: TanksGameStatus = 'menu';
  /** The tally the world last reported — the HUD follows the event stream, not the world object. */
  score = NO_SCORE;
  stageSummary: IStageSummary | undefined;
  isMuted: boolean;
  fps = 0;
  rendererFailure: string | undefined;

  readonly worldRef = new TanksWorldRef(new TanksWorld());

  /**
   * The world runs 60 times a second outside MobX and is read through this atom instead:
   * it is reported changed after every tick and every swap, so the HUD computeds follow it.
   */
  private readonly worldAtom = createAtom('TanksWorld');
  private readonly bestScoreStorage: IBestScoreStorage;
  private readonly mutedStorage: IMutedStorage;
  private readonly touchSource = new TouchControlSource();
  private readonly stopWatchingVisibility: VoidFunction;
  private recordScore: number;
  private flowTimeoutId: number | undefined;
  private stageEnemiesDestroyed = 0;
  private stagePoints = 0;

  constructor(
    bestScoreStorage: IBestScoreStorage = createBestScoreStorage(),
    mutedStorage: IMutedStorage = createMutedStorage(MUTED_STORAGE_KEY),
    visibilitySource: IVisibilitySource = createDocumentVisibilitySource()
  ) {
    this.bestScoreStorage = bestScoreStorage;
    this.recordScore = bestScoreStorage.read();
    this.mutedStorage = mutedStorage;
    this.isMuted = mutedStorage.read();

    makeAutoObservable<
      TanksStore,
      | 'worldAtom'
      | 'bestScoreStorage'
      | 'mutedStorage'
      | 'touchSource'
      | 'stopWatchingVisibility'
      | 'flowTimeoutId'
      | 'stageEnemiesDestroyed'
      | 'stagePoints'
      | 'world'
    >(
      this,
      {
        worldRef: false,
        worldAtom: false,
        bestScoreStorage: false,
        mutedStorage: false,
        touchSource: false,
        stopWatchingVisibility: false,
        flowTimeoutId: false,
        stageEnemiesDestroyed: false,
        stagePoints: false,
        world: false,
      },
      { autoBind: true }
    );

    this.stopWatchingVisibility = visibilitySource.onHidden(this.pauseWhileHidden);
  }

  get isPlaying(): boolean {
    return this.gameStatus === 'playing';
  }

  get stageNumber(): number {
    return this.world.stageNumber;
  }

  get lives(): number {
    return this.world.lives;
  }

  get enemiesRemaining(): number {
    return this.world.enemiesRemaining;
  }

  get bestScore(): number {
    return Math.max(this.recordScore, this.score);
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

    for (const event of events) {
      switch (event.type) {
        case 'enemy-destroyed':
          // Grenade kills come with points: 0 and stay out of the stage tally.
          if (event.points > 0) {
            this.stageEnemiesDestroyed++;
          }
          break;
        case 'score-awarded':
          this.stagePoints += event.points;
          this.score = event.totalScore;
          break;
        case 'stage-cleared':
          isStageCleared = true;
          break;
        case 'game-over':
          isGameOver = true;
          break;
        case 'stage-started':
        case 'enemy-spawned':
        case 'player-destroyed':
        case 'bullet-fired':
        case 'bullet-ended':
        case 'power-up-spawned':
        case 'power-up-taken':
        case 'player-ice-slide-started':
        case 'extra-life-awarded':
        case 'base-destroyed':
          break;
        default:
          assertNever(event);
      }
    }

    this.worldAtom.reportChanged();

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

  failRenderer(error: unknown): void {
    this.rendererFailure = error instanceof Error ? error.message : String(error);
  }

  dispose(): void {
    this.stopWatchingVisibility();
    this.clearFlowTimeout();
    this.persistBestScore();
    this.touchSource.dispose();
  }

  private get world(): TanksWorld {
    this.worldAtom.reportObserved();

    return this.worldRef.current;
  }

  /** A hidden tab must never lose the game — the render loop's delta clamp alone would still advance it. */
  private pauseWhileHidden(): void {
    if (this.gameStatus === 'playing') {
      this.gameStatus = 'paused';
    }
  }

  private resetRun(): void {
    this.worldRef.replace(new TanksWorld());
    this.worldAtom.reportChanged();
    this.touchSource.release();
    this.stageEnemiesDestroyed = 0;
    this.stagePoints = 0;
    this.score = NO_SCORE;
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

    this.worldAtom.reportChanged();
    this.stageEnemiesDestroyed = 0;
    this.stagePoints = 0;
    this.stageSummary = undefined;
    this.beginStageIntro();
  }

  private endRun(): void {
    this.clearFlowTimeout();
    this.gameStatus = 'game-over';
    this.persistBestScore();
    this.scheduleFlowStep(GAME_OVER_DURATION_MS, this.returnToMenu);
  }

  private persistBestScore(): void {
    if (this.bestScore <= this.recordScore) {
      return;
    }

    this.recordScore = this.bestScore;
    this.bestScoreStorage.write(this.recordScore);
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
