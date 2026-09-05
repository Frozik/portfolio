import { mat4, vec3 } from 'wgpu-matrix';

import {
  INITIAL_AZIMUTH,
  INITIAL_CAMERA_DISTANCE,
  INITIAL_ELEVATION,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
} from './constants';
import type { Vec3Array } from './topology-types';
import type { CameraProjection, PuzzleCamera } from './types';

export interface OrbitCameraSettings {
  readonly center: Vec3Array;
  readonly projection: CameraProjection;
  readonly azimuth: number;
  readonly elevation: number;
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly initialDistance: number;
}

/** A puzzle's camera with every omitted field filled from the feature defaults. */
export function resolveCameraSettings(puzzleCamera: PuzzleCamera | undefined): OrbitCameraSettings {
  return {
    center: puzzleCamera?.center ?? [0, 0, 0],
    projection: puzzleCamera?.projection ?? 'perspective',
    azimuth: puzzleCamera?.angle?.azimuth ?? INITIAL_AZIMUTH,
    elevation: puzzleCamera?.angle?.elevation ?? INITIAL_ELEVATION,
    minDistance: puzzleCamera?.distance?.min ?? MIN_CAMERA_DISTANCE,
    maxDistance: puzzleCamera?.distance?.max ?? MAX_CAMERA_DISTANCE,
    initialDistance: puzzleCamera?.distance?.initial ?? INITIAL_CAMERA_DISTANCE,
  };
}

/** Turntable orbit: the eye sits on a sphere around `target`, elevation measured from the pole. */
export function computeEyePosition(
  target: Vec3Array,
  azimuth: number,
  elevation: number,
  distance: number
): Vec3Array {
  return [
    target[0] + Math.sin(elevation) * Math.sin(azimuth) * distance,
    target[1] + Math.cos(elevation) * distance,
    target[2] + Math.sin(elevation) * Math.cos(azimuth) * distance,
  ];
}

/** Screen-plane up vector for the orbit angles. */
export function computeUpVector(azimuth: number, elevation: number): Vec3Array {
  return [
    -Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    -Math.cos(elevation) * Math.cos(azimuth),
  ];
}

/** Screen-plane right vector; always horizontal. */
export function computeRightVector(azimuth: number): Vec3Array {
  return [Math.cos(azimuth), 0, -Math.sin(azimuth)];
}

export function computeViewMatrix(eye: Vec3Array, target: Vec3Array, up: Vec3Array): Float32Array {
  return mat4.lookAt(
    vec3.fromValues(eye[0], eye[1], eye[2]),
    vec3.fromValues(target[0], target[1], target[2]),
    vec3.fromValues(up[0], up[1], up[2])
  ) as Float32Array;
}
