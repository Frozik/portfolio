import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { BallState } from '../domain/ball';
import { respawn } from '../domain/ball';
import { CLOCK_SPEED, FIXED_STEP_SECONDS } from '../domain/constants';
import type { Play, SectorSlice } from '../domain/course';
import { afterHoleOut, levelOf, slicesOf, startCourse } from '../domain/course';
import { cupCenter, hasCup } from '../domain/cup';
import type { Level } from '../domain/level';
import { previewPath } from '../domain/preview';
import { aim, shoot } from '../domain/shot';
import { step } from '../domain/step';
import { lerp } from '../domain/vector';
import { extendTrail } from './ball-trail';
import type { Size } from './camera';
import type { Seen } from './charting';
import { chart, ground, nothingSeen, sectorSizeFor } from './charting';
import { CourseView } from './CourseView';
import type { WorldRepository } from './ports/world-repository';
import { SAVED_WORLD_VERSION } from './ports/world-repository';

/** How long the burst of a destroyed ball plays before it reappears. */
const BURST_SECONDS = 0.45;
/** Frames longer than this (a background tab) advance the game by this much only. */
const MAX_FRAME_SECONDS = 0.1;

export type GameStatus = 'loading' | 'playing';

export interface Aim {
  readonly anchor: Vector2;
  readonly pull: Vector2;
}

export interface Burst {
  readonly position: Vector2;
  readonly elapsedSeconds: number;
}

/** What the renderer reads every frame. */
export interface Scene {
  /** The whole course as made so far, the cup cut in: what the physics plays on. */
  readonly level: Level;
  /** The same course sector by sector, for drawing. */
  readonly slices: readonly SectorSlice[];
  /** Where the camera looks and how far it is zoomed out. */
  readonly view: { readonly center: Vector2; readonly zoom: number };
  /** The ball as the physics has it, one fixed step at a time. */
  readonly ball: BallState;
  readonly burst: Burst | undefined;
  /** Where to draw the ball: smoothed between steps. */
  readonly ballPosition: Vector2;
  /** The flying ball's recent positions, oldest first, ending just behind `ballPosition`. */
  readonly trail: readonly Vector2[];
}

/**
 * The game: one endless course made as the ball travels, the ball, the
 * holes played and the strokes. The ball is stepped at a fixed rate from
 * the render loop and is not observable — it changes a hundred times a
 * second and only the renderer reads it; the HUD reads the observable
 * counters, which change per stroke and per hole.
 */
export class SpaceGolfStore {
  status: GameStatus = 'loading';
  holes = 0;
  totalStrokes = 0;
  strokesSinceHole = 0;
  /** How far the ball's foresight has grown: the bonuses this ball has taken. The ball itself is not observable. */
  foresight = 0;
  /** The band being pulled; nothing while no pointer is down. */
  aiming: Aim | undefined = undefined;
  /** The camera, the player's looking around and the compass. */
  readonly view = new CourseView();

  private play: Play | undefined = undefined;
  private seen: Seen = nothingSeen();
  /** The ball one physics step ago: the renderer shows it somewhere between the two. */
  private previousBall: BallState | undefined = undefined;
  private trail: readonly Vector2[] = [];
  private burst: Burst | undefined = undefined;
  private accumulatorSeconds = 0;
  private started = false;
  private disposed = false;

  constructor(
    private readonly worldRepository: WorldRepository,
    /** A seed for a new world: the shell's to supply, a constant in the specifications. */
    private readonly newWorldSeed: () => number
  ) {
    makeAutoObservable<
      this,
      | 'play'
      | 'seen'
      | 'previousBall'
      | 'trail'
      | 'burst'
      | 'accumulatorSeconds'
      | 'started'
      | 'disposed'
      | 'worldRepository'
      | 'newWorldSeed'
    >(
      this,
      {
        aiming: observableRef,
        view: false,
        play: false,
        seen: false,
        previousBall: false,
        trail: false,
        burst: false,
        accumulatorSeconds: false,
        started: false,
        disposed: false,
        worldRepository: false,
        newWorldSeed: false,
      },
      { autoBind: true }
    );
  }

  /** Frame-rate state for the renderer, read every frame. */
  get scene(): Scene | undefined {
    if (isNil(this.play)) {
      return undefined;
    }
    return {
      level: levelOf(this.play.course),
      slices: slicesOf(this.play.course),
      view: { center: this.view.center, zoom: this.view.zoom },
      ball: this.play.ball,
      burst: this.burst,
      ballPosition: this.shownPosition(this.play.ball),
      // The newest point is the step the shown ball has not reached yet.
      trail: this.trail.slice(0, -1),
    };
  }

  /** The dots of the pending stroke, or nothing while the band is slack. */
  get preview(): readonly Vector2[] | undefined {
    const velocity = this.pendingVelocity();
    if (isNil(velocity) || isNil(this.play)) {
      return undefined;
    }
    const { course, ball } = this.play;
    return previewPath(levelOf(course), ball, this.shownPosition(ball), velocity);
  }

  /**
   * Restores the world the player left, or makes a new one sized to this
   * screen; a second call is ignored.
   */
  async start(screen: Size): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    this.view.resize(screen);
    const saved = await this.worldRepository.load().catch(() => undefined);
    if (this.disposed) {
      return;
    }
    runInAction(() => {
      if (isNil(saved) || saved.version !== SAVED_WORLD_VERSION) {
        this.beginWorld();
        return;
      }
      this.holes = saved.holes;
      this.totalStrokes = saved.totalStrokes;
      this.strokesSinceHole = saved.strokesSinceHole;
      this.enter(saved.play);
    });
  }

  /** A new world from nothing: new country, the counters at nought. */
  resetWorld(): void {
    if (this.status === 'playing') {
      this.beginWorld();
    }
  }

  /** The band may be pulled at any time while the course is played; only a resting ball can be shot with it. */
  beginAim(anchor: Vector2): void {
    if (this.status === 'playing') {
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

  /** Releases the band: a stroke when it is stretched and the ball rests, nothing otherwise — the pull is simply let go. */
  release(): void {
    const velocity = this.pendingVelocity();
    this.aiming = undefined;
    if (isNil(velocity) || isNil(this.play) || this.play.ball.phase !== 'aiming') {
      return;
    }
    const ball = shoot(levelOf(this.play.course), this.play.ball, velocity);
    this.play = { ...this.play, ball };
    this.previousBall = ball;
    this.totalStrokes += 1;
    this.strokesSinceHole += 1;
    // The flight is what must be watched: a stroke takes the view back to the ball.
    this.view.attach();
  }

  /** Advances the game by a frame's worth of fixed steps, the map by a sector at most, and the camera by the frame itself. */
  advance(frameSeconds: number): void {
    if (isNil(this.play) || this.status !== 'playing') {
      return;
    }
    this.accumulatorSeconds += Math.min(frameSeconds, MAX_FRAME_SECONDS) * CLOCK_SPEED;
    while (this.accumulatorSeconds >= FIXED_STEP_SECONDS) {
      this.accumulatorSeconds -= FIXED_STEP_SECONDS;
      this.tick();
    }
    this.chartAhead();
    this.followBall(frameSeconds);
  }

  dispose(): void {
    this.disposed = true;
  }

  private beginWorld(): void {
    this.holes = 0;
    this.totalStrokes = 0;
    this.strokesSinceHole = 0;
    this.enter(startCourse(this.newWorldSeed(), sectorSizeFor(this.view.screenSize)));
    this.save();
  }

  private enter(play: Play): void {
    this.play = play;
    this.seen = nothingSeen();
    this.previousBall = play.ball;
    this.trail = [];
    this.burst = undefined;
    this.aiming = undefined;
    this.accumulatorSeconds = 0;
    this.view.reset(play.ball.position);
    this.foresight = play.ball.foresight;
    this.status = 'playing';
  }

  private tick(): void {
    if (isNil(this.play)) {
      return;
    }
    // The ball never flies over ground that is not there: its sector is made before the step.
    const grounded = ground(this.play);
    const before = grounded.ball;
    const ball = step(levelOf(grounded.course), before, FIXED_STEP_SECONDS);
    this.previousBall = before;
    this.play = { ...grounded, ball };
    this.trail = extendTrail(this.trail, ball);
    this.foresight = ball.foresight;
    if (!isNil(this.burst)) {
      this.playBurst(this.burst);
      return;
    }
    if (ball.phase === 'destroyed') {
      this.burst = { position: ball.position, elapsedSeconds: 0 };
    } else if (ball.phase === 'holed') {
      this.holeOut();
    } else if (before.phase === 'flying' && ball.phase === 'aiming') {
      this.save();
    }
  }

  private playBurst(burst: Burst): void {
    const elapsedSeconds = burst.elapsedSeconds + FIXED_STEP_SECONDS;
    this.burst = { ...burst, elapsedSeconds };
    if (elapsedSeconds >= BURST_SECONDS && !isNil(this.play)) {
      const ball = respawn(this.play.ball);
      this.burst = undefined;
      this.play = { ...this.play, ball };
      this.previousBall = ball;
      this.foresight = ball.foresight;
    }
  }

  /** The cup closes under the ball, the far country is dropped, the next cup is cut elsewhere, and play goes on. */
  private holeOut(): void {
    if (isNil(this.play)) {
      return;
    }
    this.play = afterHoleOut(this.play);
    this.previousBall = this.play.ball;
    this.seen = nothingSeen();
    this.holes += 1;
    this.strokesSinceHole = 0;
    this.save();
  }

  private chartAhead(): void {
    if (isNil(this.play)) {
      return;
    }
    const charted = chart(this.play, this.seen, this.view.visible);
    this.play = charted.play;
    this.seen = charted.seen;
  }

  private followBall(frameSeconds: number): void {
    if (isNil(this.play)) {
      return;
    }
    const { course, ball } = this.play;
    const level = levelOf(course);
    this.view.follow(
      {
        ball: this.shownPosition(ball),
        isFlying: ball.phase === 'flying',
        cup: hasCup(level) ? cupCenter(level) : undefined,
        bonus: ball.bonus.at,
      },
      frameSeconds
    );
  }

  private save(): void {
    if (isNil(this.play)) {
      return;
    }
    void this.worldRepository
      .save({
        version: SAVED_WORLD_VERSION,
        play: this.play,
        holes: this.holes,
        totalStrokes: this.totalStrokes,
        strokesSinceHole: this.strokesSinceHole,
      })
      .catch(() => undefined);
  }

  /**
   * Where the ball is drawn: between the last two physics steps, by the
   * share of a step the frame has left in the accumulator. The steps are
   * fixed and the frames are not, so a frame holds now two steps and now
   * three; drawn at the last step the ball would lurch, drawn in between it
   * glides. Only a flight is smoothed: a respawn is a jump, not a motion.
   */
  private shownPosition(ball: BallState): Vector2 {
    const previous = this.previousBall;
    if (isNil(previous) || previous.phase !== 'flying' || ball.phase !== 'flying') {
      return ball.position;
    }
    return lerp(previous.position, ball.position, this.accumulatorSeconds / FIXED_STEP_SECONDS);
  }

  private pendingVelocity(): Vector2 | undefined {
    return isNil(this.aiming) ? undefined : aim(this.aiming.anchor, this.aiming.pull);
  }
}
