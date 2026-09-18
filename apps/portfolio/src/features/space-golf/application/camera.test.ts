import { describe, expect, it } from 'vitest';

import {
  attachCamera,
  createCamera,
  glideCamera,
  MIN_ZOOM,
  EDGE_MARGIN_VIEW_SHARE,
  panCamera,
  trackCamera,
  VIEW_PIXELS_PER_METER,
  viewSizeMeters,
  zoomCamera,
} from './camera';

const PHONE = { width: 390, height: 844 };
const FRAME = 1 / 60;
const ROUNDING_METERS = 1e-9;

function settle(camera: ReturnType<typeof createCamera>, target: { x: number; y: number }) {
  let state = camera;
  for (let frame = 0; frame < 240; frame += 1) {
    state = glideCamera(state, target, FRAME);
  }
  return state;
}

describe('the camera', () => {
  it('shows the world at one scale on every screen: the view in metres is the screen in pixels over the scale', () => {
    const camera = createCamera({ x: 5, y: 5 });

    expect(viewSizeMeters(camera, PHONE).width).toBeCloseTo(390 / VIEW_PIXELS_PER_METER);
    expect(viewSizeMeters(camera, { width: 1600, height: 900 }).width).toBeCloseTo(
      1600 / VIEW_PIXELS_PER_METER
    );
  });

  it('glides to its target easing in and out — slow away, fastest midway, slow home — and stops on it without passing it', () => {
    const target = { x: 6, y: 12 };
    let state = createCamera({ x: 4, y: 12 });
    const strides: number[] = [];

    for (let frame = 0; frame < 240; frame += 1) {
      const next = glideCamera(state, target, FRAME);
      if (next.center.x !== state.center.x) {
        strides.push(next.center.x - state.center.x);
      }
      expect(next.center.x).toBeLessThanOrEqual(6 + ROUNDING_METERS);
      state = next;
    }

    const fastest = Math.max(...strides);
    expect(state.center).toEqual(target);
    expect(strides.every(stride => stride > -ROUNDING_METERS)).toBe(true);
    expect(strides[0]).toBeLessThan(fastest / 10);
    expect(strides[strides.length - 1]).toBeLessThan(fastest / 10);
    expect(strides.indexOf(fastest)).toBeGreaterThan(strides.length / 4);
    expect(strides.indexOf(fastest)).toBeLessThan((strides.length * 3) / 4);
  });

  it('takes longer over a longer way, within limits, so neither a short glide snaps nor a long one drags', () => {
    const framesTo = (distance: number): number => {
      let state = createCamera({ x: 0, y: 0 });
      let frames = 0;
      while (state.center.x !== distance) {
        state = glideCamera(state, { x: distance, y: 0 }, FRAME);
        frames += 1;
      }
      return frames;
    };

    expect(framesTo(0.1)).toBeGreaterThan(20);
    expect(framesTo(3)).toBeGreaterThan(framesTo(0.1));
    expect(framesTo(300)).toBeLessThan(70);
  });

  it('lets go of its target when panned and takes it up again when attached', () => {
    const camera = createCamera({ x: 6, y: 12 });

    const panned = panCamera(camera, { x: 0, y: 3 });
    expect(panned.attached).toBe(false);
    expect(panned.center.y).toBeCloseTo(15);
    expect(glideCamera(panned, { x: 6, y: 5 }, FRAME).center).toEqual(panned.center);

    const back = settle(attachCamera(panned), { x: 6, y: 12 });
    expect(back.attached).toBe(true);
    expect(back.center.y).toBeCloseTo(12, 2);
  });

  it('stands still while what it tracks keeps a tenth of the view away from every side', () => {
    const camera = createCamera({ x: 6, y: 12 });
    const view = viewSizeMeters(camera, PHONE);
    const reach = view.width * (1 / 2 - EDGE_MARGIN_VIEW_SHARE);
    let state = camera;

    for (let frame = 0; frame < 60; frame += 1) {
      const swing = Math.sin(frame / 10) * reach * 0.99;
      state = trackCamera(state, { x: 6 + swing, y: 12 }, PHONE);
    }

    expect(state.center).toEqual(camera.center);
  });

  it('goes with the tracked point once it crosses that margin, exactly as fast as the point goes and along that axis only', () => {
    const view = viewSizeMeters(createCamera({ x: 6, y: 12 }), PHONE);
    const reach = view.width * (1 / 2 - EDGE_MARGIN_VIEW_SHARE);
    const step = 15 * FRAME;
    const atTheMargin = trackCamera(
      createCamera({ x: 6, y: 12 }),
      { x: 6 + reach, y: 12.5 },
      PHONE
    );
    expect(atTheMargin.center).toEqual({ x: 6, y: 12 });

    const one = trackCamera(atTheMargin, { x: 6 + reach + step, y: 12.5 }, PHONE);
    const two = trackCamera(one, { x: 6 + reach + 2 * step, y: 12.5 }, PHONE);

    expect(one.center.x - atTheMargin.center.x).toBeCloseTo(step);
    expect(two.center.x - one.center.x).toBeCloseTo(step);
    expect(two.center.y).toBe(12);
  });

  it('stops with the tracked point, wherever on the screen that leaves it, and only a target to glide to centres it again', () => {
    const view = viewSizeMeters(createCamera({ x: 6, y: 12 }), PHONE);
    const point = { x: 6 + view.width, y: 12 };
    const pushed = trackCamera(createCamera({ x: 6, y: 12 }), point, PHONE);

    expect(trackCamera(pushed, point, PHONE).center).toEqual(pushed.center);
    expect(point.x - pushed.center.x).toBeCloseTo(view.width * (1 / 2 - EDGE_MARGIN_VIEW_SHARE));
    expect(settle(pushed, point).center.x).toBeCloseTo(point.x, 2);
  });

  it('zooms out to an overview and never in past the one scale', () => {
    const camera = createCamera({ x: 6, y: 12 });

    expect(zoomCamera(camera, 0.01).zoom).toBe(MIN_ZOOM);
    expect(zoomCamera(camera, 5).zoom).toBe(1);
    expect(viewSizeMeters(zoomCamera(camera, 0.5), PHONE).width).toBeCloseTo(
      (390 / VIEW_PIXELS_PER_METER) * 2
    );
  });
});
