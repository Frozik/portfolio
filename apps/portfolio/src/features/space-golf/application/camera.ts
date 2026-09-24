import type { Vector2 } from '@frozik/utils/math/vector2';
import { isNil } from 'lodash-es';

import { add, distance, lerp } from '../domain/vector';

/** The one scale the world is shown at on every device, CSS pixels per metre: the ball is nine pixels across. */
export const VIEW_PIXELS_PER_METER = 64;
/** How far the view zooms out for an overview; it never zooms in past 1. */
export const MIN_ZOOM = 0.3;
/** A screen starts out showing at least this much of the course along its shorter side: what a stroke needs to be planned… */
const HOME_VIEW_METERS = 12;
/** …but never zoomed out further than this by itself: the ball must stay a ball. */
const MIN_HOME_ZOOM = 0.5;
/** A glide to a new centre covers the way at this speed on average… */
const GLIDE_METERS_PER_SECOND = 5;
/** …but never takes less than this, so a short one does not snap, nor more than this, so a long one does not drag. */
const MIN_GLIDE_SECONDS = 0.4;
const MAX_GLIDE_SECONDS = 0.9;
/** A target this near to where the glide was going is the same target. */
const SAME_TARGET_METERS = 1e-6;
/** A tracked point is kept this share of the view away from every side of it. */
export const EDGE_MARGIN_VIEW_SHARE = 0.1;
/** Frames longer than this (a background tab) move the camera by this much only. */
const MAX_FRAME_SECONDS = 0.1;

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** A move of the centre in progress: from where, to where, and how long it has been going. */
interface Glide {
  readonly from: Vector2;
  readonly to: Vector2;
  readonly elapsedSeconds: number;
}

/**
 * Where the view looks: its centre in metres, the glide that is taking it
 * somewhere, how far it is zoomed out, and whether it still follows its
 * target — a pan lets go of it.
 */
export interface CameraState {
  readonly center: Vector2;
  readonly glide: Glide | undefined;
  readonly zoom: number;
  readonly attached: boolean;
}

export function createCamera(center: Vector2, zoom = 1): CameraState {
  return { center, glide: undefined, zoom, attached: true };
}

/**
 * The zoom a screen starts at and comes back to from the overview. At the
 * one scale a phone shows six metres across, the ball fills the eye and a
 * stroke flies out of sight at once; a narrow screen therefore starts
 * zoomed out to `HOME_VIEW_METERS` across. A wide one starts at the one
 * scale.
 */
export function homeZoomFor(screen: Size): number {
  const shorterSideMeters = Math.min(screen.width, screen.height) / VIEW_PIXELS_PER_METER;
  return Math.min(1, Math.max(MIN_HOME_ZOOM, shorterSideMeters / HOME_VIEW_METERS));
}

/** What the screen shows, in metres. */
export function viewSizeMeters(camera: CameraState, screen: Size): Size {
  const scale = VIEW_PIXELS_PER_METER * camera.zoom;
  return { width: screen.width / scale, height: screen.height / scale };
}

/**
 * The camera a frame later on its way to a target that stands still — the
 * resting ball the player asked to see in the middle, or the place that
 * shows a ball come back out of sight. The way is eased in and out: the view gathers speed, is
 * fastest midway and slows into its stop. A spring, which the first build
 * had, starts at its fastest, and a whole screen that lurches off is
 * sickening to watch. A new target starts a new glide from where the
 * camera is. A detached camera stays where the player put it.
 */
export function glideCamera(
  camera: CameraState,
  target: Vector2,
  frameSeconds: number
): CameraState {
  if (!camera.attached) {
    return camera;
  }
  const going = camera.glide;
  const glide =
    isNil(going) || distance(going.to, target) > SAME_TARGET_METERS
      ? { from: camera.center, to: target, elapsedSeconds: 0 }
      : going;
  const way = distance(glide.from, glide.to);
  if (way <= SAME_TARGET_METERS) {
    return { ...camera, center: target, glide: undefined };
  }
  const durationSeconds = Math.min(
    MAX_GLIDE_SECONDS,
    Math.max(MIN_GLIDE_SECONDS, way / GLIDE_METERS_PER_SECOND)
  );
  const elapsedSeconds = glide.elapsedSeconds + Math.min(frameSeconds, MAX_FRAME_SECONDS);
  if (elapsedSeconds >= durationSeconds) {
    return { ...camera, center: target, glide: undefined };
  }
  return {
    ...camera,
    center: lerp(glide.from, glide.to, easeInOut(elapsedSeconds / durationSeconds)),
    glide: { ...glide, elapsedSeconds },
  };
}

/** Smootherstep: no speed and no acceleration at either end. */
function easeInOut(share: number): number {
  return share * share * share * (share * (share * 6 - 15) + 10);
}

/**
 * The camera tracking a point that moves fast and far — the ball in flight.
 * A view that moves with every move of the ball is sickening to watch, so
 * the camera stands still until the point comes within
 * `EDGE_MARGIN_VIEW_SHARE` of a side of the view, and then goes with it
 * along that axis, exactly as fast as the point goes: the point is always
 * on the screen and the screen moves only when it must.
 */
export function trackCamera(camera: CameraState, point: Vector2, screen: Size): CameraState {
  if (!camera.attached) {
    return camera;
  }
  return { ...camera, center: centerShowing(camera, point, screen), glide: undefined };
}

/** The centre nearest to the camera's own from which `point` is `EDGE_MARGIN_VIEW_SHARE` clear of every side of the view. */
export function centerShowing(camera: CameraState, point: Vector2, screen: Size): Vector2 {
  const view = viewSizeMeters(camera, screen);
  const reachX = view.width * (1 / 2 - EDGE_MARGIN_VIEW_SHARE);
  const reachY = view.height * (1 / 2 - EDGE_MARGIN_VIEW_SHARE);
  return {
    x: Math.min(point.x + reachX, Math.max(point.x - reachX, camera.center.x)),
    y: Math.min(point.y + reachY, Math.max(point.y - reachY, camera.center.y)),
  };
}

/** The camera on a point outright — the ball kept in the very middle through its flight, for a player who asks for that. */
export function holdCamera(camera: CameraState, point: Vector2): CameraState {
  if (!camera.attached) {
    return camera;
  }
  return { ...camera, center: point, glide: undefined };
}

/** The view moved by hand, `delta` in metres: it lets go of its target until attached again. */
export function panCamera(camera: CameraState, delta: Vector2): CameraState {
  return { ...camera, center: add(camera.center, delta), glide: undefined, attached: false };
}

export function attachCamera(camera: CameraState): CameraState {
  return { ...camera, attached: true };
}

/** The zoom multiplied by `factor`, held between the overview and the one scale. */
export function zoomCamera(camera: CameraState, factor: number): CameraState {
  return { ...camera, zoom: Math.min(1, Math.max(MIN_ZOOM, camera.zoom * factor)) };
}
