import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { BallState } from '../domain/ball';
import { createBall, respawn } from '../domain/ball';
import { FIXED_STEP_SECONDS } from '../domain/constants';
import type { Level } from '../domain/level';
import type { Progress } from '../domain/progress';
import { completeLevel, INITIAL_PROGRESS } from '../domain/progress';
import { aim, previewDots, shoot } from '../domain/shot';
import { step } from '../domain/step';
import type { LevelSource } from './ports/level-source';
import type { ProgressRepository } from './ports/progress-repository';

/** How long the burst of a destroyed ball plays before it reappears. */
export const BURST_SECONDS = 0.45;
/** Frames longer than this (a background tab) advance the game by this much only. */
const MAX_FRAME_SECONDS = 0.1;

export type GameStatus = 'loading' | 'playing' | 'completed' | 'failed';

export interface Aim {
  readonly anchor: Vector2;
  readonly pull: Vector2;
}

export interface Burst {
  readonly position: Vector2;
  readonly elapsedSeconds: number;
}

/**
 * The game: one level at a time, the ball, the strokes and the progress.
 * The ball is stepped at a fixed rate from the render loop and is not
 * observable — it changes a hundred times a second and only the renderer
 * reads it; the HUD reads the observable counters that change per stroke.
 */
export class SpaceGolfStore {
  status: GameStatus = 'loading';
  levelNumber = INITIAL_PROGRESS.levelNumber;
  totalStrokes = INITIAL_PROGRESS.totalStrokes;
  strokeCount = 0;
  par = 0;
  /** Pickups the ball has collected on this level, out of how many the level holds. */
  collectedCount = 0;
  pickupCount = 0;
  /** The band being pulled; nothing while no pointer is down. */
  aiming: Aim | undefined = undefined;

  private level: Level | undefined = undefined;
  private ball: BallState | undefined = undefined;
  private burst: Burst | undefined = undefined;
  private progress: Progress = INITIAL_PROGRESS;
  private accumulatorSeconds = 0;
  private readonly pendingLevels = new Map<number, Promise<Level>>();
  private started = false;
  private disposed = false;

  constructor(
    private readonly levelSource: LevelSource,
    private readonly progressRepository: ProgressRepository
  ) {
    makeAutoObservable<
      this,
      | 'level'
      | 'ball'
      | 'burst'
      | 'progress'
      | 'accumulatorSeconds'
      | 'pendingLevels'
      | 'started'
      | 'disposed'
      | 'levelSource'
      | 'progressRepository'
    >(
      this,
      {
        aiming: observableRef,
        level: false,
        ball: false,
        burst: false,
        progress: false,
        accumulatorSeconds: false,
        pendingLevels: false,
        started: false,
        disposed: false,
        levelSource: false,
        progressRepository: false,
      },
      { autoBind: true }
    );
  }

  /** Frame-rate state for the renderer, read every frame. */
  get scene():
    | { readonly level: Level; readonly ball: BallState; readonly burst: Burst | undefined }
    | undefined {
    if (isNil(this.level) || isNil(this.ball)) {
      return undefined;
    }
    return { level: this.level, ball: this.ball, burst: this.burst };
  }

  /** The five dots of the pending stroke, or nothing while the band is slack. */
  get preview(): readonly Vector2[] | undefined {
    const velocity = this.pendingVelocity();
    if (isNil(velocity) || isNil(this.level) || isNil(this.ball)) {
      return undefined;
    }
    return previewDots(this.level, this.ball, velocity);
  }

  /** Whether the spike rows are drawn for the stroke about to be played or the one in flight. */
  get displayedStroke(): number {
    if (isNil(this.ball)) {
      return 0;
    }
    return this.ball.phase === 'aiming' ? this.ball.stroke + 1 : this.ball.stroke;
  }

  /** Loads the progress and the level it points at; a second call is ignored. */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    const saved = await this.progressRepository.load().catch(() => undefined);
    if (this.disposed) {
      return;
    }
    runInAction(() => {
      this.progress = saved ?? INITIAL_PROGRESS;
      this.levelNumber = this.progress.levelNumber;
      this.totalStrokes = this.progress.totalStrokes;
    });
    await this.loadLevel(this.progress.levelNumber);
  }

  beginAim(anchor: Vector2): void {
    if (this.ball?.phase === 'aiming' && this.status === 'playing') {
      this.aiming = { anchor, pull: anchor };
    }
  }

  updateAim(pull: Vector2): void {
    if (!isNil(this.aiming)) {
      this.aiming = { ...this.aiming, pull };
    }
  }

  cancelAim(): void {
    this.aiming = undefined;
  }

  /** Releases the band: a stroke when it is stretched, nothing when it is slack. */
  release(): void {
    const velocity = this.pendingVelocity();
    this.aiming = undefined;
    if (isNil(velocity) || isNil(this.ball)) {
      return;
    }
    this.ball = shoot(this.ball, velocity);
    this.strokeCount = this.ball.stroke;
  }

  /** Advances the game by a frame's worth of fixed steps. */
  advance(frameSeconds: number): void {
    const scene = this.scene;
    if (isNil(scene) || this.status !== 'playing') {
      return;
    }
    this.accumulatorSeconds += Math.min(frameSeconds, MAX_FRAME_SECONDS);
    while (this.accumulatorSeconds >= FIXED_STEP_SECONDS) {
      this.accumulatorSeconds -= FIXED_STEP_SECONDS;
      this.tick(scene.level);
    }
  }

  /** Back to the tee with a clean count; the spike rows return to their opening state. */
  restart(): void {
    if (isNil(this.level)) {
      return;
    }
    this.ball = createBall(this.level);
    this.burst = undefined;
    this.aiming = undefined;
    this.strokeCount = 0;
    this.collectedCount = 0;
    if (this.status === 'completed') {
      this.status = 'playing';
    }
  }

  async nextLevel(): Promise<void> {
    if (this.status !== 'completed') {
      return;
    }
    await this.loadLevel(this.progress.levelNumber);
  }

  dispose(): void {
    this.disposed = true;
    this.pendingLevels.clear();
    this.levelSource.dispose();
  }

  private pendingVelocity(): Vector2 | undefined {
    return isNil(this.aiming) ? undefined : aim(this.aiming.anchor, this.aiming.pull);
  }

  private tick(level: Level): void {
    if (isNil(this.ball)) {
      return;
    }
    if (!isNil(this.burst)) {
      const elapsedSeconds = this.burst.elapsedSeconds + FIXED_STEP_SECONDS;
      this.burst = { ...this.burst, elapsedSeconds };
      if (elapsedSeconds >= BURST_SECONDS) {
        this.burst = undefined;
        this.ball = respawn(this.ball);
      }
      return;
    }
    if (this.ball.phase === 'destroyed') {
      this.burst = { position: this.ball.position, elapsedSeconds: 0 };
      return;
    }
    if (this.ball.phase !== 'flying') {
      return;
    }
    const previous = this.ball;
    const next = step(level, previous, FIXED_STEP_SECONDS);
    this.ball = next;
    if (next.collected !== previous.collected) {
      this.collectedCount = next.collected.size;
    }
    if (next.phase === 'holed') {
      this.completeCurrentLevel(next.stroke);
    }
  }

  private completeCurrentLevel(strokes: number): void {
    this.progress = completeLevel(this.progress, this.levelNumber, strokes);
    this.totalStrokes = this.progress.totalStrokes;
    this.status = 'completed';
    void this.progressRepository.save(this.progress).catch(() => undefined);
    this.prefetch(this.progress.levelNumber);
  }

  private async loadLevel(levelNumber: number): Promise<void> {
    this.status = 'loading';
    let level: Level;
    try {
      level = await this.request(levelNumber);
    } catch {
      if (!this.disposed) {
        runInAction(() => {
          this.status = 'failed';
        });
      }
      return;
    }
    if (this.disposed) {
      return;
    }
    runInAction(() => {
      this.pendingLevels.delete(levelNumber);
      this.level = level;
      this.ball = createBall(level);
      this.burst = undefined;
      this.aiming = undefined;
      this.levelNumber = levelNumber;
      this.strokeCount = 0;
      this.collectedCount = 0;
      this.pickupCount = level.pickups.length;
      this.par = level.par;
      this.accumulatorSeconds = 0;
      this.status = 'playing';
    });
    this.prefetch(levelNumber + 1);
  }

  private request(levelNumber: number): Promise<Level> {
    let pending = this.pendingLevels.get(levelNumber);
    if (isNil(pending)) {
      pending = this.levelSource.generate(levelNumber);
      this.pendingLevels.set(levelNumber, pending);
    }
    return pending;
  }

  /** The next level is generated while this one is played, so the switch is instant. */
  private prefetch(levelNumber: number): void {
    this.request(levelNumber).catch(() => {
      this.pendingLevels.delete(levelNumber);
    });
  }
}
