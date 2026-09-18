import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';
import { makeAutoObservable, observableRef } from 'mobx';

import type { Bounds } from '../domain/level';
import { distance, subtract } from '../domain/vector';
import type { CameraState, Size } from './camera';
import {
  attachCamera,
  centerShowing,
  createCamera,
  glideCamera,
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

/** Which way the cup lies from the ball and how far; nothing to point at while the cup is on screen. */
export interface Compass {
  /** Degrees clockwise from straight up on the screen. */
  readonly angleDegrees: number;
  readonly distanceMeters: number;
  readonly cupOnScreen: boolean;
  /** Which way the bonus lies, while there is one and it is out of sight. */
  readonly bonusAngleDegrees: number | undefined;
}

/** What the view follows this frame. */
export interface Followed {
  /** Where the ball is drawn. */
  readonly ball: Vector2;
  readonly isFlying: boolean;
  /** Nothing between a hole-out and the next cup. */
  readonly cup: Vector2 | undefined;
  readonly bonus: Vector2 | undefined;
}

/**
 * The player's view of the course, at one scale on every device: a camera
 * that stays where it is while the ball rests and the stroke is aimed,
 * centres on the ball only when the player asks, and stands
 * still through a flight until the ball nears the edge of the screen; the
 * player's own looking around, which lets go of the ball;
 * and the compass to the cup. The camera moves every frame and is not
 * observable; what the HUD shows is.
 */
export class CourseView {
  /** Whether the view follows the ball; a pan lets go of it. */
  isAttached = true;
  isOverview = false;
  compass: Compass | undefined = undefined;
  /** A measure of the world as long as it is on the screen now. */
  scaleBar: ScaleBar = scaleBarFor(1);

  private camera: CameraState = createCamera(NOWHERE);
  /** The player has asked for the ball in the middle and the glide there is not over. */
  private centring = false;
  private screen: Size = { width: 1, height: 1 };

  constructor() {
    makeAutoObservable<this, 'camera' | 'centring' | 'screen'>(
      this,
      {
        compass: observableRef,
        scaleBar: observableRef,
        camera: false,
        centring: false,
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

  /** Moves the view by hand: CSS pixels to the right and down the screen. It lets go of the ball. */
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

  /** The player's own asking for the ball in the middle of the screen: nothing else centres the view. */
  centerOnBall(): void {
    this.attach();
    this.centring = true;
  }

  /** A frame of following, and the compass kept pointing at the cup. */
  follow(followed: Followed, frameSeconds: number): void {
    if (followed.isFlying) {
      this.centring = false;
      this.camera = trackCamera(this.camera, followed.ball, this.screen);
    } else {
      // A flight leaves the ball in sight and the view where it is; only a ball come back elsewhere needs going to.
      const target = this.centring
        ? followed.ball
        : centerShowing(this.camera, followed.ball, this.screen);
      this.camera = glideCamera(this.camera, target, frameSeconds);
      this.centring = this.centring && !isNil(this.camera.glide);
    }
    this.pointCompass(followed);
  }

  private isZoomedOut(): boolean {
    return this.camera.zoom < homeZoomFor(this.screen) - SAME_ZOOM_TOLERANCE;
  }

  private pointCompass(followed: Followed): void {
    if (isNil(followed.cup)) {
      this.compass = undefined;
      return;
    }
    const { visible } = this;
    const inSight = (point: Vector2): boolean =>
      point.x >= visible.min.x &&
      point.x <= visible.max.x &&
      point.y >= visible.min.y &&
      point.y <= visible.max.y;
    const bearing = (point: Vector2): number => {
      const to = subtract(point, followed.ball);
      return (Math.atan2(to.x, to.y) * HALF_TURN_DEGREES) / Math.PI;
    };
    const next: Compass = {
      angleDegrees: bearing(followed.cup),
      distanceMeters: distance(followed.cup, followed.ball),
      cupOnScreen: inSight(followed.cup),
      bonusAngleDegrees:
        isNil(followed.bonus) || inSight(followed.bonus) ? undefined : bearing(followed.bonus),
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
      turned(shown.bonusAngleDegrees, next.bonusAngleDegrees) ||
      Math.abs(shown.distanceMeters - next.distanceMeters) >= COMPASS_DISTANCE_STEP_METERS
    ) {
      this.compass = next;
    }
  }
}
