import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef } from 'mobx';

import type { BonusKind } from '../domain/bonus';
import type { Bounds } from '../domain/level';
import { distance, subtract } from '../domain/vector';
import type { CameraState, Size } from './camera';
import {
  attachCamera,
  centerShowing,
  createCamera,
  glideCamera,
  holdCamera,
  homeZoomFor,
  MIN_ZOOM,
  panCamera,
  trackCamera,
  VIEW_PIXELS_PER_METER,
  viewSizeMeters,
  zoomCamera,
} from './camera';
import type { ScaleBar } from './scale-bar';
import { scaleBarFor } from './scale-bar';

/** The compass is an observable the HUD renders: it changes only by steps a player can see. */
const COMPASS_ANGLE_STEP_DEGREES = 2;
const COMPASS_DISTANCE_STEP_METERS = 0.5;
const HALF_TURN_DEGREES = 180;
const NOWHERE: Vector2 = { x: 0, y: 0 };
/** Zooms closer than this are the same zoom: a pinch back to the home zoom is not an overview. */
const SAME_ZOOM_TOLERANCE = 1e-6;
/** Presses of the ball button this close together count on from one another; one later starts over. */
const PRESS_WINDOW_SECONDS = 2;

/**
 * How the view keeps the ball: at the edge only — standing still until the
 * ball nears a side of the screen, the way that never makes a screen swim;
 * centred whenever it comes to rest; or centred always, the flight and all.
 */
export type Following = 'edge' | 'rest' | 'always';

const NEXT_FOLLOWING: Readonly<Record<Following, Following>> = {
  edge: 'rest',
  rest: 'always',
  always: 'edge',
};

/** Which way the cup lies from the ball and how far; nothing to point at while the cup is on screen. */
export interface Compass {
  /** Degrees clockwise from straight up on the screen. */
  readonly angleDegrees: number;
  readonly distanceMeters: number;
  readonly cupOnScreen: boolean;
  /** Which way the bonus lies and which it is, while there is one and it is out of sight. */
  readonly bonus: { readonly angleDegrees: number; readonly kind: BonusKind } | undefined;
}

/** What the view follows this frame. */
export interface Followed {
  /** Where the ball is drawn. */
  readonly ball: Vector2;
  readonly isFlying: boolean;
  /** Nothing between a hole-out and the next cup. */
  readonly cup: Vector2 | undefined;
  readonly bonus: { readonly at: Vector2; readonly kind: BonusKind } | undefined;
}

/**
 * The player's view of the course, at one scale on every device: a camera
 * that stays where it is while the ball rests and the stroke is aimed,
 * centres on the ball when the player asks and when a burst one comes back
 * to its rest, and stands still through a flight until the ball nears the
 * edge of the screen — or, as the ball button's presses set it, centres the
 * ball whenever it rests, or keeps it in the middle always; the player's
 * own looking around, which wins over all of that and lets go of the ball
 * until a stroke is played; and the compass to the cup. The camera moves
 * every frame and is not observable; what the HUD shows is.
 */
export class CourseView {
  /** Whether the view follows the ball; a pan lets go of it. */
  isAttached = true;
  isOverview = false;
  /** How the ball is kept, as the ball button's presses have set it. */
  following: Following = 'edge';
  compass: Compass | undefined = undefined;
  /** A measure of the world as long as it is on the screen now. */
  scaleBar: ScaleBar = scaleBarFor(1);

  private camera: CameraState = createCamera(NOWHERE);
  /** The ball has been asked for in the middle and the glide there is not over. */
  private centring = false;
  /** Since the ball button was last pressed: the next press counts on from it only within the window. */
  private sincePressSeconds = Number.POSITIVE_INFINITY;
  private screen: Size = { width: 1, height: 1 };

  constructor() {
    makeAutoObservable<this, 'camera' | 'centring' | 'sincePressSeconds' | 'screen'>(
      this,
      {
        compass: observableRef,
        scaleBar: observableRef,
        camera: false,
        centring: false,
        sincePressSeconds: false,
        screen: false,
      },
      { autoBind: true }
    );
  }

  get center(): Vector2 {
    return this.camera.center;
  }

  get zoom(): number {
    return this.camera.zoom;
  }

  /** The screen in CSS pixels, as last told. */
  get screenSize(): Size {
    return this.screen;
  }

  /** What of the course is on screen, in metres. */
  get visible(): Bounds {
    const view = viewSizeMeters(this.camera, this.screen);
    const { center } = this;
    return {
      min: { x: center.x - view.width / 2, y: center.y - view.height / 2 },
      max: { x: center.x + view.width / 2, y: center.y + view.height / 2 },
    };
  }

  /** A new course: the view starts on `center`, following, at the screen's home zoom. */
  reset(center: Vector2): void {
    this.camera = createCamera(center, homeZoomFor(this.screen));
    this.centring = false;
    this.isAttached = true;
    this.isOverview = false;
    this.scaleBar = scaleBarFor(this.camera.zoom);
    this.compass = undefined;
  }

  /** The size of what the world is shown on, in CSS pixels. */
  resize(screen: Size): void {
    this.screen = screen;
    this.isOverview = this.isZoomedOut();
  }

  /**
   * Moves the view by hand: CSS pixels to the right and down the screen. The
   * hand wins over every motion of the view's own — a glide under way, a
   * flight being followed, a ball to be centred at rest — and the view is
   * left where the hand put it until the next stroke takes it back.
   */
  pan(rightPixels: number, downPixels: number): void {
    const metersPerPixel = 1 / (VIEW_PIXELS_PER_METER * this.camera.zoom);
    this.camera = panCamera(this.camera, {
      x: rightPixels * metersPerPixel,
      y: -downPixels * metersPerPixel,
    });
    this.centring = false;
    this.isAttached = false;
  }

  zoomBy(factor: number): void {
    this.camera = zoomCamera(this.camera, factor);
    this.isOverview = this.isZoomedOut();
    this.scaleBar = scaleBarFor(this.camera.zoom);
  }

  /** Out to the whole reach of the zoom in one press, and back to the screen's home zoom in another. */
  toggleOverview(): void {
    const target = this.isOverview ? homeZoomFor(this.screen) : MIN_ZOOM;
    this.zoomBy(target / this.camera.zoom);
  }

  /** Follows the ball again, from wherever the player had looked away to. */
  attach(): void {
    this.camera = attachCamera(this.camera);
    this.isAttached = true;
  }

  /**
   * The ball button, or what stands for it — a double tap, `C`: the ball
   * is put in the middle of the screen, and presses in quick succession
   * count round the ways of following — the edge, then centred at rest,
   * then centred always. A press after a pause starts over at the edge,
   * whatever was set: the way out of any mode is to wait and press once.
   */
  centerOnBall(): void {
    this.attach();
    this.following =
      this.sincePressSeconds <= PRESS_WINDOW_SECONDS ? NEXT_FOLLOWING[this.following] : 'edge';
    this.sincePressSeconds = 0;
    this.centring = true;
  }

  /**
   * A burst ball come back to its rest is put in the middle of the screen,
   * the following left as it is — unless the player has looked away, when
   * the view stays where they put it, as it does for everything automatic.
   */
  centerOnReturnedBall(): void {
    if (this.isAttached) {
      this.centring = true;
    }
  }

  /** A frame of following, and the compass kept pointing at the cup. */
  follow(followed: Followed, frameSeconds: number): void {
    this.sincePressSeconds += frameSeconds;
    if (followed.isFlying) {
      this.centring = false;
      this.camera =
        this.following === 'always'
          ? holdCamera(this.camera, followed.ball)
          : trackCamera(this.camera, followed.ball, this.screen);
    } else {
      // A flight leaves the ball in sight and the view where it is; only a
      // ball moved elsewhere needs going to — unless the ball is to be centred at rest.
      const target =
        this.centring || this.following !== 'edge'
          ? followed.ball
          : centerShowing(this.camera, followed.ball, this.screen);
      this.camera = glideCamera(this.camera, target, frameSeconds);
      this.centring = this.centring && !isNil(this.camera.glide);
    }
    this.pointCompass(followed);
  }

  private inSight(point: Vector2): boolean {
    const { visible } = this;
    return (
      point.x >= visible.min.x &&
      point.x <= visible.max.x &&
      point.y >= visible.min.y &&
      point.y <= visible.max.y
    );
  }

  private isZoomedOut(): boolean {
    return this.camera.zoom < homeZoomFor(this.screen) - SAME_ZOOM_TOLERANCE;
  }

  private pointCompass(followed: Followed): void {
    if (isNil(followed.cup)) {
      this.compass = undefined;
      return;
    }
    const bearing = (point: Vector2): number => {
      const to = subtract(point, followed.ball);
      return (Math.atan2(to.x, to.y) * HALF_TURN_DEGREES) / Math.PI;
    };
    const next: Compass = {
      angleDegrees: bearing(followed.cup),
      distanceMeters: distance(followed.cup, followed.ball),
      cupOnScreen: this.inSight(followed.cup),
      bonus:
        isNil(followed.bonus) || this.inSight(followed.bonus.at)
          ? undefined
          : { angleDegrees: bearing(followed.bonus.at), kind: followed.bonus.kind },
    };
    const shown = this.compass;
    const turned = (before: number | undefined, after: number | undefined): boolean =>
      isNil(before) || isNil(after)
        ? before !== after
        : Math.abs(before - after) >= COMPASS_ANGLE_STEP_DEGREES;
    if (
      isNil(shown) ||
      shown.cupOnScreen !== next.cupOnScreen ||
      turned(shown.angleDegrees, next.angleDegrees) ||
      shown.bonus?.kind !== next.bonus?.kind ||
      turned(shown.bonus?.angleDegrees, next.bonus?.angleDegrees) ||
      Math.abs(shown.distanceMeters - next.distanceMeters) >= COMPASS_DISTANCE_STEP_METERS
    ) {
      this.compass = next;
    }
  }
}
