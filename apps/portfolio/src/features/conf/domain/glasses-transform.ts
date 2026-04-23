import {
  GLASSES_BASE_WIDTH_PX,
  LANDMARK_INDEX_LEFT_EYE_INNER,
  LANDMARK_INDEX_LEFT_EYE_OUTER,
  LANDMARK_INDEX_RIGHT_EYE_INNER,
  LANDMARK_INDEX_RIGHT_EYE_OUTER,
  MIN_LANDMARKS_FOR_GLASSES,
} from './constants';
import type { INormalizedPoint } from './types';

/**
 * A single 3D face-mesh landmark as produced by MediaPipe's
 * `FaceLandmarker`. Coordinates are normalized to `[0, 1]` over the
 * input image. `z` is kept on the wire for completeness but the glasses
 * math only consumes the `x` / `y` pair.
 */
export interface IFaceLandmark {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Rendered size (CSS pixels) of the `<video>` element the overlay covers. */
export interface IVideoSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The transform the presentation layer applies to the glasses SVG group
 * so it lines up over the face. All offsets are in CSS pixels relative
 * to the `<video>` element's top-left corner.
 */
export interface IGlassesTransform {
  readonly translateX: number;
  readonly translateY: number;
  readonly rotateDeg: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

const HALF = 0.5;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Compute the affine transform placing the glasses overlay over the
 * face described by `landmarks`.
 *
 * Pipeline (documented here so implementation cannot silently drift):
 *  1. Require `landmarks.length >= MIN_LANDMARKS_FOR_GLASSES` — return
 *     `null` otherwise so the caller can hide the overlay.
 *  2. Translation = midpoint of the inner eye corners (indices 133 and
 *     362), scaled from normalized coordinates into CSS pixels using
 *     the `<video>` element's rendered size.
 *  3. Rotation = `atan2(dy, dx)` of the vector from the left-eye outer
 *     corner (33) to the right-eye outer corner (263), in CSS pixels.
 *  4. Scale = inter-ocular distance (outer-corner to outer-corner) in
 *     CSS pixels, divided by `GLASSES_BASE_WIDTH_PX`. Applied
 *     uniformly to X and Y — glasses do not squash.
 *
 * The function is pure and has no framework dependencies. Smoothing
 * happens in the infrastructure layer before this function is called.
 */
export function computeGlassesTransform(
  landmarks: readonly IFaceLandmark[],
  videoSize: IVideoSize
): IGlassesTransform | null {
  if (landmarks.length < MIN_LANDMARKS_FOR_GLASSES) {
    return null;
  }
  if (videoSize.width <= 0 || videoSize.height <= 0) {
    return null;
  }

  const leftOuter = landmarks[LANDMARK_INDEX_LEFT_EYE_OUTER];
  const leftInner = landmarks[LANDMARK_INDEX_LEFT_EYE_INNER];
  const rightInner = landmarks[LANDMARK_INDEX_RIGHT_EYE_INNER];
  const rightOuter = landmarks[LANDMARK_INDEX_RIGHT_EYE_OUTER];

  const midpointNorm: INormalizedPoint = {
    x: (leftInner.x + rightInner.x) * HALF,
    y: (leftInner.y + rightInner.y) * HALF,
  };

  const translateX = midpointNorm.x * videoSize.width;
  const translateY = midpointNorm.y * videoSize.height;

  const dxPx = (rightOuter.x - leftOuter.x) * videoSize.width;
  const dyPx = (rightOuter.y - leftOuter.y) * videoSize.height;

  const rotateDeg = Math.atan2(dyPx, dxPx) * RAD_TO_DEG;
  const interOcularPx = Math.hypot(dxPx, dyPx);
  const scale = interOcularPx / GLASSES_BASE_WIDTH_PX;

  return {
    translateX,
    translateY,
    rotateDeg,
    scaleX: scale,
    scaleY: scale,
  };
}
