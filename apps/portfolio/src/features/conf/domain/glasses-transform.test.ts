import { describe, expect, it } from 'vitest';
import {
  GLASSES_BASE_WIDTH_PX,
  LANDMARK_INDEX_LEFT_EYE_INNER,
  LANDMARK_INDEX_LEFT_EYE_OUTER,
  LANDMARK_INDEX_RIGHT_EYE_INNER,
  LANDMARK_INDEX_RIGHT_EYE_OUTER,
  MIN_LANDMARKS_FOR_GLASSES,
} from './constants';
import type { IFaceLandmark } from './glasses-transform';
import { computeGlassesTransform } from './glasses-transform';

const VIDEO_SIZE = { width: 640, height: 480 };
const FLOAT_TOLERANCE = 1e-6;

function makeLandmarks(overrides: Record<number, IFaceLandmark>): IFaceLandmark[] {
  const result: IFaceLandmark[] = [];
  for (let index = 0; index < MIN_LANDMARKS_FOR_GLASSES; index += 1) {
    result.push(overrides[index] ?? { x: 0, y: 0, z: 0 });
  }
  return result;
}

function makeHorizontalFace(
  leftOuterX: number,
  rightOuterX: number,
  eyeY: number,
  innerOffset: number
): IFaceLandmark[] {
  return makeLandmarks({
    [LANDMARK_INDEX_LEFT_EYE_OUTER]: { x: leftOuterX, y: eyeY, z: 0 },
    [LANDMARK_INDEX_LEFT_EYE_INNER]: { x: leftOuterX + innerOffset, y: eyeY, z: 0 },
    [LANDMARK_INDEX_RIGHT_EYE_INNER]: { x: rightOuterX - innerOffset, y: eyeY, z: 0 },
    [LANDMARK_INDEX_RIGHT_EYE_OUTER]: { x: rightOuterX, y: eyeY, z: 0 },
  });
}

describe('computeGlassesTransform', () => {
  it('returns a straight-ahead identity pose for a centered horizontal face', () => {
    // Outer corners span 0.25 wide around the centerline, at half height.
    const landmarks = makeHorizontalFace(0.375, 0.625, 0.5, 0.08);
    const transform = computeGlassesTransform(landmarks, VIDEO_SIZE);
    expect(transform).not.toBeNull();
    if (transform === null) {
      return;
    }
    // Midpoint of the two inner corners sits exactly at the center.
    expect(transform.translateX).toBeCloseTo(VIDEO_SIZE.width * 0.5, 6);
    expect(transform.translateY).toBeCloseTo(VIDEO_SIZE.height * 0.5, 6);
    expect(transform.rotateDeg).toBeCloseTo(0, 6);
    // interOcular = 0.25 * 640 = 160 px; scale = 160 / base.
    const expectedScale = (0.25 * VIDEO_SIZE.width) / GLASSES_BASE_WIDTH_PX;
    expect(transform.scaleX).toBeCloseTo(expectedScale, 6);
    expect(transform.scaleY).toBeCloseTo(expectedScale, 6);
    expect(transform.scaleX).toEqual(transform.scaleY);
  });

  it('yields a positive rotation when the head tilts so the right eye drops', () => {
    // Left outer at (0.3, 0.45), right outer at (0.7, 0.55). dy > 0 -> rotation > 0.
    const landmarks = makeLandmarks({
      [LANDMARK_INDEX_LEFT_EYE_OUTER]: { x: 0.3, y: 0.45, z: 0 },
      [LANDMARK_INDEX_LEFT_EYE_INNER]: { x: 0.45, y: 0.48, z: 0 },
      [LANDMARK_INDEX_RIGHT_EYE_INNER]: { x: 0.55, y: 0.52, z: 0 },
      [LANDMARK_INDEX_RIGHT_EYE_OUTER]: { x: 0.7, y: 0.55, z: 0 },
    });
    const transform = computeGlassesTransform(landmarks, VIDEO_SIZE);
    expect(transform).not.toBeNull();
    if (transform === null) {
      return;
    }
    const dxPx = (0.7 - 0.3) * VIDEO_SIZE.width;
    const dyPx = (0.55 - 0.45) * VIDEO_SIZE.height;
    const expectedRotation = (Math.atan2(dyPx, dxPx) * 180) / Math.PI;
    expect(transform.rotateDeg).toBeCloseTo(expectedRotation, 6);
    expect(transform.rotateDeg).toBeGreaterThan(0);
  });

  it('scales down for a small face further from the camera', () => {
    const small = computeGlassesTransform(makeHorizontalFace(0.45, 0.55, 0.5, 0.04), VIDEO_SIZE);
    const large = computeGlassesTransform(makeHorizontalFace(0.3, 0.7, 0.5, 0.08), VIDEO_SIZE);
    expect(small).not.toBeNull();
    expect(large).not.toBeNull();
    if (small === null || large === null) {
      return;
    }
    expect(small.scaleX).toBeLessThan(large.scaleX);
    expect(small.scaleX).toBeGreaterThan(0);
  });

  it('returns null when the landmark array is too short', () => {
    const shortList: IFaceLandmark[] = [
      { x: 0.1, y: 0.2, z: 0 },
      { x: 0.2, y: 0.3, z: 0 },
    ];
    expect(computeGlassesTransform(shortList, VIDEO_SIZE)).toBeNull();
  });

  it('returns null when the video element has zero size', () => {
    const landmarks = makeHorizontalFace(0.375, 0.625, 0.5, 0.08);
    expect(computeGlassesTransform(landmarks, { width: 0, height: 480 })).toBeNull();
    expect(computeGlassesTransform(landmarks, { width: 640, height: 0 })).toBeNull();
  });

  it('computes -90deg rotation when head rolls so right eye is above left', () => {
    // Vertical alignment: left outer at bottom, right outer at top.
    const landmarks = makeLandmarks({
      [LANDMARK_INDEX_LEFT_EYE_OUTER]: { x: 0.5, y: 0.75, z: 0 },
      [LANDMARK_INDEX_LEFT_EYE_INNER]: { x: 0.5, y: 0.6, z: 0 },
      [LANDMARK_INDEX_RIGHT_EYE_INNER]: { x: 0.5, y: 0.4, z: 0 },
      [LANDMARK_INDEX_RIGHT_EYE_OUTER]: { x: 0.5, y: 0.25, z: 0 },
    });
    const transform = computeGlassesTransform(landmarks, VIDEO_SIZE);
    expect(transform).not.toBeNull();
    if (transform === null) {
      return;
    }
    // atan2(-0.5 * height, 0) = -PI/2 -> -90 degrees.
    expect(transform.rotateDeg).toBeCloseTo(-90, 6);
  });

  it('produces a uniform scale along both axes', () => {
    const landmarks = makeHorizontalFace(0.3, 0.7, 0.5, 0.1);
    const transform = computeGlassesTransform(landmarks, VIDEO_SIZE);
    expect(transform).not.toBeNull();
    if (transform === null) {
      return;
    }
    expect(Math.abs(transform.scaleX - transform.scaleY)).toBeLessThan(FLOAT_TOLERANCE);
  });
});
