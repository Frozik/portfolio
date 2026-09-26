import { DEGREES_PER_RADIAN, MAX_PITCH_RADIANS, MAX_ZOOM, MIN_ZOOM } from './constants';
import type { MapCameraState, PixelPoint, Viewport } from './map-camera';
import {
  cameraGeometry,
  coastCamera,
  createMapCamera,
  dragCamera,
  moveCameraTo,
  projectGround,
  rotateBy,
  tiltBy,
  unprojectToGround,
  viewOf,
  zoomAround,
} from './map-camera';
import { DEFAULT_VIEW } from './map-view';

const VIEWPORT: Viewport = { widthPx: 1600, heightPx: 900 };
const CENTER: PixelPoint = { x: 800, y: 450 };
const LOWER_LEFT: PixelPoint = { x: 300, y: 800 };
/** Far enough from the zoom ceiling for the tests that zoom in. */
const CITY_ZOOM = 14;

function flatCamera(): MapCameraState {
  return createMapCamera({ ...DEFAULT_VIEW, zoom: CITY_ZOOM, pitchDeg: 0, bearingDeg: 0 });
}

function tiltedCamera(): MapCameraState {
  return createMapCamera({ ...DEFAULT_VIEW, zoom: CITY_ZOOM, pitchDeg: 55, bearingDeg: 30 });
}

describe('map camera', () => {
  it('sees its target under the screen centre at any pitch and bearing', () => {
    for (const state of [flatCamera(), tiltedCamera()]) {
      const ground = unprojectToGround(state, VIEWPORT, CENTER);

      expect(ground?.x).toBeCloseTo(state.target.x, 12);
      expect(ground?.y).toBeCloseTo(state.target.y, 12);
    }
  });

  it('projects a ground point back to the pixel it was unprojected from', () => {
    for (const state of [flatCamera(), tiltedCamera()]) {
      const geometry = cameraGeometry(state, VIEWPORT);
      for (const pixel of [CENTER, LOWER_LEFT]) {
        const ground = unprojectToGround(state, VIEWPORT, pixel);
        const back = projectGround(geometry, ground ?? { x: -1, y: -1 });

        expect(back?.x).toBeCloseTo(pixel.x, 3);
        expect(back?.y).toBeCloseTo(pixel.y, 3);
      }
    }
  });

  it('reports nothing for a ground point behind the camera', () => {
    const state = tiltedCamera();
    const geometry = cameraGeometry(state, VIEWPORT);
    const ahead = unprojectToGround(state, VIEWPORT, CENTER) ?? { x: -1, y: -1 };
    const behind = {
      x: geometry.position.x - (ahead.x - geometry.position.x),
      y: geometry.position.z - (ahead.y - geometry.position.z),
    };

    expect(projectGround(geometry, behind)).toBeUndefined();
  });

  it('puts east on the right and north on top when looking straight down', () => {
    const state = flatCamera();

    const right = unprojectToGround(state, VIEWPORT, { x: 1200, y: 450 });
    const top = unprojectToGround(state, VIEWPORT, { x: 800, y: 100 });

    expect(right?.x).toBeGreaterThan(state.target.x);
    expect(right?.y).toBeCloseTo(state.target.y, 12);
    expect(top?.y).toBeLessThan(state.target.y);
    expect(top?.x).toBeCloseTo(state.target.x, 12);
  });

  it('looks past the fog at the top of the screen when fully tilted', () => {
    const state = createMapCamera({ ...DEFAULT_VIEW, pitchDeg: 65 });
    const geometry = cameraGeometry(state, VIEWPORT);

    const top = unprojectToGround(state, VIEWPORT, { x: 800, y: 0 });

    expect(top).toBeDefined();
    const distance = Math.hypot(
      (top?.x ?? 0) - geometry.position.x,
      geometry.position.y,
      (top?.y ?? 0) - geometry.position.z
    );
    expect(distance).toBeGreaterThan(geometry.fogEnd);
  });

  it('reports the sky for pixels above the horizon', () => {
    const state: MapCameraState = { ...flatCamera(), pitch: 80 / DEGREES_PER_RADIAN };

    expect(unprojectToGround(state, VIEWPORT, { x: 800, y: 0 })).toBeUndefined();
    expect(unprojectToGround(state, VIEWPORT, { x: 800, y: 899 })).toBeDefined();
  });

  it('keeps the ground point under the cursor while zooming around it', () => {
    const state = tiltedCamera();
    const before = unprojectToGround(state, VIEWPORT, LOWER_LEFT);

    const zoomed = zoomAround(state, VIEWPORT, 1.3, LOWER_LEFT);
    const after = unprojectToGround(zoomed, VIEWPORT, LOWER_LEFT);

    expect(zoomed.zoom).toBeCloseTo(state.zoom + 1.3, 12);
    expect(after?.x).toBeCloseTo(before?.x ?? Number.NaN, 12);
    expect(after?.y).toBeCloseTo(before?.y ?? Number.NaN, 12);
  });

  it('keeps the grabbed ground point under the pointer while dragging', () => {
    const state = tiltedCamera();
    const to: PixelPoint = { x: 330, y: 780 };
    const grabbed = unprojectToGround(state, VIEWPORT, LOWER_LEFT);

    const dragged = dragCamera(state, VIEWPORT, LOWER_LEFT, to, 16);
    const underPointer = unprojectToGround(dragged, VIEWPORT, to);

    expect(underPointer?.x).toBeCloseTo(grabbed?.x ?? Number.NaN, 12);
    expect(underPointer?.y).toBeCloseTo(grabbed?.y ?? Number.NaN, 12);
    expect(Math.hypot(dragged.velocity.x, dragged.velocity.y)).toBeGreaterThan(0);
  });

  it('caps a single pan step near the horizon to one camera distance', () => {
    const state = createMapCamera({ ...DEFAULT_VIEW, pitchDeg: 65 });
    const nearHorizon: PixelPoint = { x: 800, y: 20 };
    const { distance } = cameraGeometry(state, VIEWPORT);

    const dragged = dragCamera(state, VIEWPORT, nearHorizon, { x: 800, y: 40 }, 16);
    const step = Math.hypot(dragged.target.x - state.target.x, dragged.target.y - state.target.y);

    expect(step).toBeLessThanOrEqual(distance * (1 + 1e-12));
    expect(step).toBeGreaterThan(distance * 0.99);
  });

  it('coasts along the last drag and settles to rest', () => {
    let state = dragCamera(tiltedCamera(), VIEWPORT, LOWER_LEFT, { x: 320, y: 790 }, 16);
    const startX = state.target.x;

    state = coastCamera(state);
    const afterOneFrame = state.target.x;
    for (let frame = 0; frame < 500; frame++) {
      state = coastCamera(state);
    }

    expect(afterOneFrame).not.toBe(startX);
    expect(state.velocity).toEqual({ x: 0, y: 0 });
  });

  it('clamps zoom, pitch and the target to the world', () => {
    const state = createMapCamera({
      lat: 89,
      lon: 250,
      zoom: MAX_ZOOM + 3,
      bearingDeg: 0,
      pitchDeg: 89,
    });

    expect(state.zoom).toBe(MAX_ZOOM);
    expect(state.pitch).toBe(MAX_PITCH_RADIANS);
    expect(state.target.x).toBeLessThanOrEqual(1);
    expect(zoomAround(state, VIEWPORT, -50, CENTER).zoom).toBe(MIN_ZOOM);
    expect(tiltBy(state, 1).pitch).toBe(MAX_PITCH_RADIANS);
    expect(tiltBy(state, -10).pitch).toBe(0);
  });

  it('moves over a place without touching zoom, bearing or pitch', () => {
    const state = tiltedCamera();
    const paris = { lat: 48.8566, lon: 2.3522 };

    const moved = moveCameraTo(state, paris);
    const view = viewOf(moved);

    expect(view.lat).toBeCloseTo(paris.lat, 9);
    expect(view.lon).toBeCloseTo(paris.lon, 9);
    expect(moved.zoom).toBe(state.zoom);
    expect(moved.bearing).toBe(state.bearing);
    expect(moved.pitch).toBe(state.pitch);
  });

  it('wraps the bearing and reports the pose back as a view', () => {
    const rotated = rotateBy(flatCamera(), 350 / DEGREES_PER_RADIAN);
    const view = viewOf(rotated);

    expect(view.bearingDeg).toBeCloseTo(-10, 9);
    expect(view.lat).toBeCloseTo(DEFAULT_VIEW.lat, 9);
    expect(view.lon).toBeCloseTo(DEFAULT_VIEW.lon, 9);
    expect(view.zoom).toBe(CITY_ZOOM);
  });
});
