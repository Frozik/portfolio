import { createPointerGestureTracker } from '@frozik/utils/webgpu/pointerGestureTracker';
import { clamp } from 'lodash-es';
import type { Mat4 } from 'wgpu-matrix';
import { mat4 } from 'wgpu-matrix';
import type { Meters } from '../domain/units';
import { DEGREES_TO_RADIANS } from '../domain/units';
import type { WorldPoint } from '../domain/view/world-frame';

const UP_DIRECTION: WorldPoint = [0, 1, 0];

/** A lens wide enough to hold a plot without the barrel look of a very wide one. */
const FIELD_OF_VIEW_RADIANS = Math.PI / 4;
/**
 * Depth range for a scene measured in metres: the near plane sits inside a
 * single step so the ground never clips as the camera dives, and the far plane
 * clears the widest framing of a plot several hundred metres across.
 */
const NEAR_PLANE_METERS: Meters = 0.2;
const FAR_PLANE_METERS: Meters = 1000;

/** The opening view: the plot seen from above its south-east corner. */
const INITIAL_YAW_DEGREES = 45;
const INITIAL_PITCH_DEGREES = 35;
/** Grazing and plan views both stay just short of degenerate. */
const MIN_PITCH_DEGREES = 3;
const MAX_PITCH_DEGREES = 88;

const MIN_DISTANCE_METERS: Meters = 2;
const MAX_DISTANCE_METERS: Meters = 500;
/** Framing radius used until the plot announces its own. */
const DEFAULT_SITE_RADIUS_METERS: Meters = 25;
/** Air left around the plot when the camera frames it. */
const FRAMING_MARGIN = 1.2;

const ORBIT_RADIANS_PER_PIXEL = 0.006;
/**
 * Panning speed, per pixel of drag and per metre of camera distance: a plot
 * viewed from afar slides under the pointer at the same apparent rate as one
 * viewed from close up.
 */
const PAN_METERS_PER_PIXEL_PER_METER = 0.0018;
/** A notch of a wheel (`deltaY` ≈ 100) moves the camera about 15 % closer. */
const WHEEL_ZOOM_PER_DELTA = 0.0015;

/** Share of the remaining zoom distance covered each frame. */
const ZOOM_SMOOTHING_FACTOR = 0.18;
const ZOOM_SETTLED_METERS: Meters = 0.001;

const INERTIA_DAMPING = 0.9;
/** Below this residual drag speed (client pixels per frame) the glide stops. */
const INERTIA_MIN_VELOCITY_PX = 0.15;
/**
 * A drag that stopped moving this long before the release is a deliberate
 * placement, not a fling — the stale velocity must not send the camera off.
 */
const INERTIA_RELEASE_TIMEOUT_MS = 80;

const PRIMARY_BUTTON = 0;

/** Where the camera returns to: the plot's centre and the extent to be framed. */
export interface OrbitCameraHome {
  readonly target: WorldPoint;
  /** Distance from the centre of the plot to its furthest corner. */
  readonly radiusMeters: Meters;
}

export interface OrbitCamera {
  /** Advances the glide and the zoom by one frame; true while either is running. */
  tick(): boolean;
  getViewMatrix(): Mat4;
  getProjectionMatrix(aspect: number): Mat4;
  getEyePosition(): WorldPoint;
  /**
   * The orbit angle, in degrees: at 0 the camera stands south of the plot and
   * looks due plan north, and a growing yaw turns the view anticlockwise.
   */
  getYawDegrees(): number;
  /**
   * Points the camera at a plot of this extent. Applied at once while the user
   * has not taken the camera anywhere, so a plan opened on a plot of any size
   * starts framed; once the camera has been moved, only {@link reset} re-frames
   * it — a plot edited in the 2D view must not yank the view from under it.
   */
  setHome(home: OrbitCameraHome): void;
  reset(): void;
  destroy(): void;
}

/**
 * Orbit camera for the 3D view: drag orbits, the secondary button (or two
 * fingers, or Shift) pans along the ground, wheel and pinch dolly in and out.
 * Structurally a sibling of the stereometry camera rather than a reuse of it —
 * that one is a turntable around a fixed figure with no pitch and no ground
 * plane, this one flies over a site the user pans across.
 */
export function createOrbitCamera(canvas: HTMLCanvasElement): OrbitCamera {
  let home: OrbitCameraHome = {
    target: [0, 0, 0],
    radiusMeters: DEFAULT_SITE_RADIUS_METERS,
  };

  let yawRadians = INITIAL_YAW_DEGREES * DEGREES_TO_RADIANS;
  let pitchRadians = INITIAL_PITCH_DEGREES * DEGREES_TO_RADIANS;
  const target: [number, number, number] = [0, 0, 0];
  let distance = framingDistance(home.radiusMeters);
  let targetDistance = distance;

  /** Until the camera is moved, a plot of a new size re-frames it (see `setHome`). */
  let hasUserMoved = false;
  let isPanGesture = false;
  let lastDragTimeMs = 0;
  let yawVelocityPx = 0;
  let pitchVelocityPx = 0;
  let panVelocityXPx = 0;
  let panVelocityYPx = 0;

  const viewScratch = mat4.create();
  const projectionScratch = mat4.create();

  function framingDistance(radiusMeters: Meters): Meters {
    return clamp(
      (radiusMeters * FRAMING_MARGIN) / Math.tan(FIELD_OF_VIEW_RADIANS / 2),
      MIN_DISTANCE_METERS,
      MAX_DISTANCE_METERS
    );
  }

  function applyHome(): void {
    target[0] = home.target[0];
    target[1] = home.target[1];
    target[2] = home.target[2];
    yawRadians = INITIAL_YAW_DEGREES * DEGREES_TO_RADIANS;
    pitchRadians = INITIAL_PITCH_DEGREES * DEGREES_TO_RADIANS;
    distance = framingDistance(home.radiusMeters);
    targetDistance = distance;
  }

  function computeEyePosition(): WorldPoint {
    const groundRadius = Math.cos(pitchRadians) * distance;

    return [
      target[0] + groundRadius * Math.sin(yawRadians),
      target[1] + Math.sin(pitchRadians) * distance,
      target[2] + groundRadius * Math.cos(yawRadians),
    ];
  }

  /** Screen right, projected on the ground: the axis a horizontal drag slides along. */
  function computeGroundRight(): WorldPoint {
    return [Math.cos(yawRadians), 0, -Math.sin(yawRadians)];
  }

  /** Screen up, projected on the ground: away from the camera, along its heading. */
  function computeGroundForward(): WorldPoint {
    return [-Math.sin(yawRadians), 0, -Math.cos(yawRadians)];
  }

  function resetVelocity(): void {
    yawVelocityPx = 0;
    pitchVelocityPx = 0;
    panVelocityXPx = 0;
    panVelocityYPx = 0;
  }

  function applyOrbit(deltaXPx: number, deltaYPx: number): void {
    yawRadians -= deltaXPx * ORBIT_RADIANS_PER_PIXEL;
    pitchRadians = clamp(
      pitchRadians - deltaYPx * ORBIT_RADIANS_PER_PIXEL,
      MIN_PITCH_DEGREES * DEGREES_TO_RADIANS,
      MAX_PITCH_DEGREES * DEGREES_TO_RADIANS
    );
  }

  /** The ground point under the pointer keeps up with it: both axes move against the drag. */
  function applyPan(deltaXPx: number, deltaYPx: number): void {
    const panScale = PAN_METERS_PER_PIXEL_PER_METER * distance;
    const right = computeGroundRight();
    const forward = computeGroundForward();

    target[0] += (forward[0] * deltaYPx - right[0] * deltaXPx) * panScale;
    target[2] += (forward[2] * deltaYPx - right[2] * deltaXPx) * panScale;
  }

  function zoomBy(factor: number): void {
    hasUserMoved = true;
    targetDistance = clamp(targetDistance * factor, MIN_DISTANCE_METERS, MAX_DISTANCE_METERS);
  }

  const gestureTracker = createPointerGestureTracker(canvas, {
    onGestureStart: (event: PointerEvent) => {
      isPanGesture = event.button !== PRIMARY_BUTTON || event.shiftKey;
    },
    onDrag: (deltaX: number, deltaY: number) => {
      hasUserMoved = true;
      lastDragTimeMs = performance.now();

      if (isPanGesture) {
        panVelocityXPx = deltaX;
        panVelocityYPx = deltaY;
        yawVelocityPx = 0;
        pitchVelocityPx = 0;
        applyPan(deltaX, deltaY);

        return;
      }

      yawVelocityPx = deltaX;
      pitchVelocityPx = deltaY;
      panVelocityXPx = 0;
      panVelocityYPx = 0;
      applyOrbit(deltaX, deltaY);
    },
    // Two fingers pan and zoom at once, as they do on a map; no inertia follows
    // them, so a pinch that ends leaves the camera exactly where it was let go.
    onTwoPointerDrag: (deltaX: number, deltaY: number) => {
      hasUserMoved = true;
      resetVelocity();
      applyPan(deltaX, deltaY);
    },
    onPinch: zoomBy,
    onWheel: (deltaY: number) => zoomBy(1 + deltaY * WHEEL_ZOOM_PER_DELTA),
    onGestureEnd: () => {
      isPanGesture = false;

      if (performance.now() - lastDragTimeMs > INERTIA_RELEASE_TIMEOUT_MS) {
        resetVelocity();
      }
    },
    onReset: () => {
      isPanGesture = false;
      resetVelocity();
    },
  });

  /** Right-drag is the pan gesture, so the canvas cannot also open a context menu. */
  const handleContextMenu = (event: MouseEvent): void => event.preventDefault();

  canvas.addEventListener('contextmenu', handleContextMenu);

  return {
    tick(): boolean {
      const isZooming = Math.abs(targetDistance - distance) > ZOOM_SETTLED_METERS;

      distance = isZooming
        ? distance + (targetDistance - distance) * ZOOM_SMOOTHING_FACTOR
        : targetDistance;

      if (gestureTracker.hasActivePointers()) {
        return true;
      }

      const hasOrbitVelocity =
        Math.abs(yawVelocityPx) >= INERTIA_MIN_VELOCITY_PX ||
        Math.abs(pitchVelocityPx) >= INERTIA_MIN_VELOCITY_PX;
      const hasPanVelocity =
        Math.abs(panVelocityXPx) >= INERTIA_MIN_VELOCITY_PX ||
        Math.abs(panVelocityYPx) >= INERTIA_MIN_VELOCITY_PX;

      if (!hasOrbitVelocity && !hasPanVelocity) {
        resetVelocity();

        return isZooming;
      }

      if (hasOrbitVelocity) {
        applyOrbit(yawVelocityPx, pitchVelocityPx);
        yawVelocityPx *= INERTIA_DAMPING;
        pitchVelocityPx *= INERTIA_DAMPING;
      }

      if (hasPanVelocity) {
        applyPan(panVelocityXPx, panVelocityYPx);
        panVelocityXPx *= INERTIA_DAMPING;
        panVelocityYPx *= INERTIA_DAMPING;
      }

      return true;
    },

    getViewMatrix(): Mat4 {
      return mat4.lookAt(computeEyePosition(), target, UP_DIRECTION, viewScratch);
    },

    getProjectionMatrix(aspect: number): Mat4 {
      return mat4.perspective(
        FIELD_OF_VIEW_RADIANS,
        aspect,
        NEAR_PLANE_METERS,
        FAR_PLANE_METERS,
        projectionScratch
      );
    },

    getEyePosition(): WorldPoint {
      return computeEyePosition();
    },

    getYawDegrees(): number {
      return yawRadians / DEGREES_TO_RADIANS;
    },

    setHome(nextHome: OrbitCameraHome): void {
      home = nextHome;

      if (!hasUserMoved) {
        applyHome();
      }
    },

    reset(): void {
      hasUserMoved = false;
      resetVelocity();
      applyHome();
    },

    destroy(): void {
      canvas.removeEventListener('contextmenu', handleContextMenu);
      gestureTracker.destroy();
    },
  };
}
