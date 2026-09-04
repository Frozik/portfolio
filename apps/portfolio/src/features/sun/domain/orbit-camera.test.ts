import { vec3 } from 'wgpu-matrix';

import {
  cameraViewMatrix,
  coastCamera,
  createOrbitCamera,
  dragCamera,
  rotateCamera,
  zoomCamera,
} from './orbit-camera';
import {
  INERTIA_DAMPING,
  INERTIA_STALE_MOVE_MS,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
} from './sun-constants';

const DRAG_PX = 40;

describe('orbit camera', () => {
  it('keeps the camera on the unit sphere with a unit up vector after any drag', () => {
    let state = createOrbitCamera();
    for (let step = 0; step < 50; step++) {
      state = rotateCamera(state, DRAG_PX, -DRAG_PX / 2);
    }

    expect(vec3.length(state.position)).toBeCloseTo(1, 6);
    expect(vec3.length(state.up)).toBeCloseTo(1, 6);
  });

  it('turns a horizontal drag into an orbit around the up axis, leaving the height alone', () => {
    const initial = createOrbitCamera();
    const turned = rotateCamera(initial, DRAG_PX, 0);

    expect(turned.position[1]).toBeCloseTo(initial.position[1], 6);
    expect(turned.position[0]).not.toBeCloseTo(initial.position[0], 3);
    expect(turned).not.toBe(initial);
  });

  it('clamps the zoom distance to the configured range', () => {
    const initial = createOrbitCamera();

    expect(zoomCamera(initial, 0).distance).toBe(MIN_CAMERA_DISTANCE);
    expect(zoomCamera(initial, 1e6).distance).toBe(MAX_CAMERA_DISTANCE);
  });

  it('coasts with damped velocity after a drag and comes to rest', () => {
    const dragged = dragCamera(createOrbitCamera(), DRAG_PX, 0, 0);
    expect(dragged.velocity).toEqual({ x: DRAG_PX, y: 0 });

    const coasted = coastCamera(dragged);
    expect(coasted.velocity.x).toBeCloseTo(DRAG_PX * INERTIA_DAMPING, 6);
    expect(coasted.position).not.toEqual(dragged.position);

    let resting = coasted;
    for (let frame = 0; frame < 500; frame++) {
      resting = coastCamera(resting);
    }
    expect(resting.velocity).toEqual({ x: 0, y: 0 });
  });

  it('drops the inertia when the previous drag step went stale', () => {
    const stale = dragCamera(createOrbitCamera(), DRAG_PX, 0, INERTIA_STALE_MOVE_MS + 1);

    expect(stale.velocity).toEqual({ x: 0, y: 0 });
  });

  it('looks at the origin from the scaled position', () => {
    const state = zoomCamera(createOrbitCamera(), 1);
    const view = cameraViewMatrix(state);
    const eyeInView = vec3.transformMat4(vec3.scale(state.position, state.distance), view);

    expect(eyeInView[0]).toBeCloseTo(0, 5);
    expect(eyeInView[1]).toBeCloseTo(0, 5);
    expect(eyeInView[2]).toBeCloseTo(0, 5);
  });
});
