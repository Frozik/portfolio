import { wrapToHalfTurn } from '@frozik/utils/math/wrapToHalfTurn';
import { clamp } from 'lodash-es';
import type { Mat4 } from 'wgpu-matrix';
import { mat4 } from 'wgpu-matrix';

import {
  DEGREES_PER_RADIAN,
  FAR_PLANE_MARGIN,
  FOG_END_FACTOR,
  FOG_START_FACTOR,
  FOV_RADIANS,
  INERTIA_DAMPING,
  INERTIA_MIN_VELOCITY_PX,
  INERTIA_STALE_MOVE_MS,
  MAX_PAN_STEP_FACTOR,
  MAX_PITCH_RADIANS,
  MAX_ZOOM,
  MIN_ZOOM,
  NEAR_PLANE_FACTOR,
  TILE_SIZE_PX,
} from './constants';
import type { MapView } from './map-view';
import type { GroundPoint, LonLat } from './mercator';
import { lonLatToWorld, worldToLonLat } from './mercator';
import { metresPerUnitAtPoint } from './tile-grid';

export interface Viewport {
  readonly widthPx: number;
  readonly heightPx: number;
}

/** Device pixels from the canvas top-left corner. */
export interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Perspective camera over the Mercator plane. In 3D the ground is `Y = 0`
 * with `X = ground.x` (east) and `Z = ground.y` (south); the camera looks at
 * `target` from a distance set by `zoom`, tilted back by `pitch` and turned
 * by `bearing` (0 = north up, clockwise).
 */
export interface MapCameraState {
  readonly target: GroundPoint;
  readonly zoom: number;
  readonly bearing: number;
  readonly pitch: number;
  /** Last pan step in world units, replayed with damping once the pointer is released. */
  readonly velocity: GroundPoint;
}

/** A 3D vector in float64: `y` is up, `x`/`z` are the ground `x`/`y`. */
export interface WorldVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Everything the renderer and the tile walk need for one pose. The
 * view-projection is built around `origin` (the target), not the world
 * origin: a float32 world coordinate near 0.6 is only good to ~6e-8, a few
 * percent of a zoom-19 tile, so the GPU only ever sees positions relative
 * to the target while the walk stays in float64.
 */
export interface CameraGeometry {
  readonly origin: GroundPoint;
  readonly position: WorldVector;
  readonly viewProjection: Mat4;
  readonly viewport: Viewport;
  readonly focalPx: number;
  readonly distance: number;
  readonly fogStart: number;
  readonly fogEnd: number;
}

const NO_VELOCITY: GroundPoint = { x: 0, y: 0 };
const HALF_NDC_RANGE = 2;

export function createMapCamera(view: MapView): MapCameraState {
  return clampCamera({
    target: lonLatToWorld(view),
    zoom: view.zoom,
    bearing: view.bearingDeg / DEGREES_PER_RADIAN,
    pitch: view.pitchDeg / DEGREES_PER_RADIAN,
    velocity: NO_VELOCITY,
  });
}

export function viewOf(state: MapCameraState): MapView {
  return {
    ...worldToLonLat(state.target),
    zoom: state.zoom,
    bearingDeg: state.bearing * DEGREES_PER_RADIAN,
    pitchDeg: state.pitch * DEGREES_PER_RADIAN,
  };
}

function clampCamera(state: MapCameraState): MapCameraState {
  return {
    ...state,
    target: { x: clamp(state.target.x, 0, 1), y: clamp(state.target.y, 0, 1) },
    zoom: clamp(state.zoom, MIN_ZOOM, MAX_ZOOM),
    bearing: wrapToHalfTurn(state.bearing),
    pitch: clamp(state.pitch, 0, MAX_PITCH_RADIANS),
  };
}

function worldPerPixel(zoom: number): number {
  return 1 / (TILE_SIZE_PX * 2 ** zoom);
}

/** Ground metres under one CSS pixel at the camera target: the size of a screen-anchored pattern drawn on the ground. */
export function groundMetresPerCssPixel(state: MapCameraState, devicePixelRatio: number): number {
  return worldPerPixel(state.zoom) * devicePixelRatio * metresPerUnitAtPoint(state.target);
}

function focalLengthPx(viewport: Viewport): number {
  return viewport.heightPx / (2 * Math.tan(FOV_RADIANS / 2));
}

function cameraDistance(state: MapCameraState, viewport: Viewport): number {
  return focalLengthPx(viewport) * worldPerPixel(state.zoom);
}

interface CameraBasis {
  readonly position: WorldVector;
  readonly forward: WorldVector;
  readonly up: WorldVector;
  readonly right: WorldVector;
}

function cameraBasis(state: MapCameraState, viewport: Viewport): CameraBasis {
  const distance = cameraDistance(state, viewport);
  const headingX = Math.sin(state.bearing);
  const headingY = -Math.cos(state.bearing);
  const sinPitch = Math.sin(state.pitch);
  const cosPitch = Math.cos(state.pitch);
  const forward = { x: headingX * sinPitch, y: -cosPitch, z: headingY * sinPitch };
  return {
    position: {
      x: state.target.x - forward.x * distance,
      y: -forward.y * distance,
      z: state.target.y - forward.z * distance,
    },
    forward,
    up: { x: headingX * cosPitch, y: sinPitch, z: headingY * cosPitch },
    right: { x: -headingY, y: 0, z: headingX },
  };
}

export function cameraGeometry(state: MapCameraState, viewport: Viewport): CameraGeometry {
  const { position, forward, up } = cameraBasis(state, viewport);
  const distance = cameraDistance(state, viewport);
  const fogEnd = distance * FOG_END_FACTOR;
  const aspect = viewport.widthPx / Math.max(1, viewport.heightPx);
  const eye = [position.x - state.target.x, position.y, position.z - state.target.y];
  const view = mat4.lookAt(
    eye,
    [eye[0] + forward.x, eye[1] + forward.y, eye[2] + forward.z],
    [up.x, up.y, up.z]
  );
  const projection = mat4.perspective(
    FOV_RADIANS,
    aspect,
    distance * NEAR_PLANE_FACTOR,
    fogEnd * FAR_PLANE_MARGIN
  );
  return {
    origin: state.target,
    position,
    viewProjection: mat4.multiply(projection, view),
    viewport,
    focalPx: focalLengthPx(viewport),
    distance,
    fogStart: distance * FOG_START_FACTOR,
    fogEnd,
  };
}

/** Where a ground point lands on the canvas, or `undefined` when it is behind the camera. */
export function projectGround(
  geometry: CameraGeometry,
  point: GroundPoint
): PixelPoint | undefined {
  const { viewProjection: m, origin, viewport } = geometry;
  const x = point.x - origin.x;
  const z = point.y - origin.y;
  const clipW = m[3] * x + m[11] * z + m[15];
  if (clipW <= 0) {
    return undefined;
  }
  const ndcX = (m[0] * x + m[8] * z + m[12]) / clipW;
  const ndcY = (m[1] * x + m[9] * z + m[13]) / clipW;
  return {
    x: ((ndcX + 1) / HALF_NDC_RANGE) * viewport.widthPx,
    y: ((1 - ndcY) / HALF_NDC_RANGE) * viewport.heightPx,
  };
}

/** The ground point under a pixel, or `undefined` when the pixel looks at the sky. */
export function unprojectToGround(
  state: MapCameraState,
  viewport: Viewport,
  pixel: PixelPoint
): GroundPoint | undefined {
  const { position, forward, up, right } = cameraBasis(state, viewport);
  const halfHeight = Math.tan(FOV_RADIANS / 2);
  const halfWidth = halfHeight * (viewport.widthPx / Math.max(1, viewport.heightPx));
  const ndcX = (pixel.x / viewport.widthPx) * HALF_NDC_RANGE - 1;
  const ndcY = 1 - (pixel.y / viewport.heightPx) * HALF_NDC_RANGE;
  const rightScale = ndcX * halfWidth;
  const upScale = ndcY * halfHeight;
  const direction = {
    x: forward.x + right.x * rightScale + up.x * upScale,
    y: forward.y + right.y * rightScale + up.y * upScale,
    z: forward.z + right.z * rightScale + up.z * upScale,
  };
  if (direction.y >= 0) {
    return undefined;
  }
  const distanceAlongRay = -position.y / direction.y;
  return {
    x: position.x + direction.x * distanceAlongRay,
    y: position.z + direction.z * distanceAlongRay,
  };
}

function translateTarget(state: MapCameraState, delta: GroundPoint): MapCameraState {
  return clampCamera({
    ...state,
    target: { x: state.target.x + delta.x, y: state.target.y + delta.y },
  });
}

/** Moves the map so the ground point that was under `from` ends up under `to`. */
function panByGrab(
  state: MapCameraState,
  viewport: Viewport,
  from: PixelPoint,
  to: PixelPoint
): MapCameraState {
  const grabbed = unprojectToGround(state, viewport, from);
  const current = unprojectToGround(state, viewport, to);
  if (grabbed === undefined || current === undefined) {
    return state;
  }
  return translateTarget(state, limitPanStep(state, viewport, subtract(grabbed, current)));
}

/** Near the horizon a pixel spans kilometres; a single step is capped so the map cannot fly away. */
function limitPanStep(state: MapCameraState, viewport: Viewport, delta: GroundPoint): GroundPoint {
  const maxStep = cameraDistance(state, viewport) * MAX_PAN_STEP_FACTOR;
  const length = Math.hypot(delta.x, delta.y);
  return length > maxStep
    ? { x: (delta.x / length) * maxStep, y: (delta.y / length) * maxStep }
    : delta;
}

/** A drag step: pans by grab and remembers the step as inertia unless the previous step went stale. */
export function dragCamera(
  state: MapCameraState,
  viewport: Viewport,
  from: PixelPoint,
  to: PixelPoint,
  elapsedSinceLastMoveMs: number
): MapCameraState {
  const panned = panByGrab(state, viewport, from, to);
  const velocity =
    elapsedSinceLastMoveMs > INERTIA_STALE_MOVE_MS
      ? NO_VELOCITY
      : subtract(panned.target, state.target);
  return { ...panned, velocity };
}

export function stopInertia(state: MapCameraState): MapCameraState {
  return state.velocity === NO_VELOCITY ? state : { ...state, velocity: NO_VELOCITY };
}

/** One frame of coasting after a release; settles to rest below a sub-pixel velocity. */
export function coastCamera(state: MapCameraState): MapCameraState {
  const { velocity } = state;
  const minVelocity = INERTIA_MIN_VELOCITY_PX * worldPerPixel(state.zoom);
  if (Math.hypot(velocity.x, velocity.y) < minVelocity) {
    return stopInertia(state);
  }
  return {
    ...translateTarget(state, velocity),
    velocity: { x: velocity.x * INERTIA_DAMPING, y: velocity.y * INERTIA_DAMPING },
  };
}

/** Changes the zoom while the ground point under `anchor` stays under `anchor`. */
export function zoomAround(
  state: MapCameraState,
  viewport: Viewport,
  zoomDelta: number,
  anchor: PixelPoint
): MapCameraState {
  const zoomed = clampCamera({ ...state, zoom: state.zoom + zoomDelta });
  const grabbed = unprojectToGround(state, viewport, anchor);
  const current = unprojectToGround(zoomed, viewport, anchor);
  if (grabbed === undefined || current === undefined) {
    return zoomed;
  }
  return translateTarget(zoomed, subtract(grabbed, current));
}

export function rotateBy(state: MapCameraState, deltaRadians: number): MapCameraState {
  return clampCamera({ ...state, bearing: state.bearing + deltaRadians });
}

export function tiltBy(state: MapCameraState, deltaRadians: number): MapCameraState {
  return clampCamera({ ...state, pitch: state.pitch + deltaRadians });
}

export function setCameraView(state: MapCameraState, view: MapView): MapCameraState {
  return { ...createMapCamera(view), velocity: state.velocity };
}

/** Centres the camera over a place, keeping its zoom, bearing and pitch. */
export function moveCameraTo(state: MapCameraState, position: LonLat): MapCameraState {
  return clampCamera({ ...state, target: lonLatToWorld(position), velocity: NO_VELOCITY });
}

function subtract(a: GroundPoint, b: GroundPoint): GroundPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}
