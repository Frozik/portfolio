import { mat4 } from 'wgpu-matrix';

import { computeMvpMatrix, computeProjectionMatrix, viewportAspect } from './camera-projection';
import { FAR_PLANE, FIELD_OF_VIEW_RADIANS, NEAR_PLANE, ORTHO_SCALE } from './constants';

describe('computeProjectionMatrix', () => {
  it('builds the perspective frustum from the configured field of view and planes', () => {
    const expected = mat4.perspective(FIELD_OF_VIEW_RADIANS, 1.5, NEAR_PLANE, FAR_PLANE);

    expect(Array.from(computeProjectionMatrix('perspective', 1.5, 5))).toEqual(
      Array.from(expected)
    );
  });

  it('scales the orthographic box with the camera distance', () => {
    const halfHeight = 4 * ORTHO_SCALE;
    const expected = mat4.ortho(
      -halfHeight * 2,
      halfHeight * 2,
      -halfHeight,
      halfHeight,
      NEAR_PLANE,
      FAR_PLANE
    );

    expect(Array.from(computeProjectionMatrix('orthographic', 2, 4))).toEqual(Array.from(expected));
  });

  it('writes into the provided matrix', () => {
    const out = mat4.create() as Float32Array;

    expect(computeProjectionMatrix('perspective', 1, 5, out)).toBe(out);
  });
});

describe('computeMvpMatrix', () => {
  it('applies the view before the projection', () => {
    const projection = computeProjectionMatrix('perspective', 1, 5);
    const view = mat4.translation([1, 2, 3]) as Float32Array;

    expect(Array.from(computeMvpMatrix(projection, view))).toEqual(
      Array.from(mat4.multiply(projection, view))
    );
  });
});

describe('viewportAspect', () => {
  it('never divides by a zero height', () => {
    expect(viewportAspect(100, 0)).toBe(100);
  });
});
