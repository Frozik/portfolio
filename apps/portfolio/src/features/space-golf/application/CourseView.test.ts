import { describe, expect, it } from 'vitest';

import type { Followed } from './CourseView';
import { CourseView } from './CourseView';

const DESKTOP = { width: 1600, height: 900 };
const FRAME = 1 / 60;
const BALL = { x: 50, y: 50 };

function followed(overrides: Partial<Followed> = {}): Followed {
  return {
    ball: BALL,
    isFlying: false,
    cup: { x: 50, y: 90 },
    bonus: undefined,
    ...overrides,
  };
}

function settled(view: CourseView, target: Followed): CourseView {
  for (let frame = 0; frame < 240; frame += 1) {
    view.follow(target, FRAME);
  }
  return view;
}

function createView(): CourseView {
  const view = new CourseView();
  view.reset(BALL);
  view.resize(DESKTOP);
  return view;
}

describe('the view of the course', () => {
  it('centres on the ball only when the player asks, gliding there', () => {
    const view = createView();
    const offCentre = { x: 53, y: 48 };
    expect(settled(view, followed({ ball: offCentre })).center).toEqual(BALL);

    view.centerOnBall();
    view.follow(followed({ ball: offCentre }), FRAME);
    expect(view.center.x).toBeGreaterThan(50);
    expect(view.center.x).toBeLessThan(53);
    expect(settled(view, followed({ ball: offCentre })).center).toEqual(offCentre);
  });

  it('centres once per asking: the next flight leaves the view where it ends', () => {
    const view = createView();
    view.centerOnBall();
    settled(view, followed());

    view.follow(followed({ isFlying: true, ball: { x: 54, y: 50 } }), FRAME);

    expect(settled(view, followed({ ball: { x: 54, y: 50 } })).center).toEqual(BALL);
  });

  it('goes, gliding, just far enough to show a ball that has come back out of sight', () => {
    const view = createView();
    const halfWidth = DESKTOP.width / 64 / 2;
    const cameBack = { x: 50 + halfWidth * 3, y: 50 };

    view.follow(followed({ ball: cameBack }), FRAME);
    expect(view.center.x).toBeLessThan(50 + halfWidth);

    const shown = settled(view, followed({ ball: cameBack }));
    expect(cameBack.x - shown.center.x).toBeCloseTo(halfWidth * 0.8);
    expect(shown.center.y).toBe(50);
  });

  it('holds still through a flight until the ball comes within a tenth of the screen from a side, goes with it from there, and stays where the flight left it once the ball rests', () => {
    const view = createView();
    const halfWidth = DESKTOP.width / 64 / 2;

    view.follow(followed({ isFlying: true, ball: { x: 50 + halfWidth * 0.79, y: 50 } }), FRAME);
    expect(view.center).toEqual(BALL);

    let ball = BALL;
    for (let frame = 1; frame <= 120; frame += 1) {
      ball = { x: 50 + frame * 15 * FRAME, y: 50 };
      view.follow(followed({ isFlying: true, ball }), FRAME);
      expect(ball.x - view.center.x).toBeLessThanOrEqual(halfWidth * 0.8 + 1e-9);
    }
    expect(ball.x - view.center.x).toBeCloseTo(halfWidth * 0.8);
    expect(view.center.y).toBe(50);

    const atLanding = view.center;
    expect(settled(view, followed({ ball })).center).toEqual(atLanding);
  });

  it('points the compass at the cup — straight up is nought, clockwise — with the distance, and knows when the cup is in sight', () => {
    const above = settled(createView(), followed({ cup: { x: 50, y: 90 } }));
    expect(above.compass?.angleDegrees).toBeCloseTo(0);
    expect(above.compass?.distanceMeters).toBeCloseTo(40);
    expect(above.compass?.cupOnScreen).toBe(false);

    const toTheRight = settled(createView(), followed({ cup: { x: 58, y: 50 } }));
    expect(toTheRight.compass?.angleDegrees).toBeCloseTo(90);
    expect(toTheRight.compass?.cupOnScreen).toBe(true);
  });

  it('adds an arrow to the bonus only while the bonus is out of sight, and has no compass with no cup', () => {
    const far = settled(createView(), followed({ bonus: { x: 50, y: 10 } }));
    expect(far.compass?.bonusAngleDegrees).toBeCloseTo(180);

    const near = settled(createView(), followed({ bonus: { x: 52, y: 50 } }));
    expect(near.compass?.bonusAngleDegrees).toBeUndefined();

    expect(settled(createView(), followed({ cup: undefined })).compass).toBeUndefined();
  });

  it('keeps the compass still for changes too small to see', () => {
    const view = settled(createView(), followed());
    const before = view.compass;

    view.follow(followed({ ball: { x: 50.05, y: 50 } }), FRAME);

    expect(view.compass).toBe(before);
  });

  it('lets go of the ball when the player looks around and takes it up again on demand', () => {
    const view = settled(createView(), followed());

    view.pan(640, 0);
    expect(view.isAttached).toBe(false);
    expect(view.center.x).toBeCloseTo(60, 1);
    view.follow(followed(), FRAME);
    expect(view.center.x).toBeCloseTo(60, 1);

    view.centerOnBall();
    expect(view.isAttached).toBe(true);
    expect(settled(view, followed()).center.x).toBeCloseTo(50, 1);
  });

  it('goes out to the overview and back in one press each', () => {
    const view = createView();

    view.toggleOverview();
    expect(view.isOverview).toBe(true);
    expect(view.zoom).toBeLessThan(1);
    expect(view.scaleBar.meters).toBeGreaterThan(1);
    view.toggleOverview();
    expect(view.isOverview).toBe(false);
    expect(view.zoom).toBe(1);
    expect(view.scaleBar).toEqual({ meters: 1, pixels: 64 });
  });
});
