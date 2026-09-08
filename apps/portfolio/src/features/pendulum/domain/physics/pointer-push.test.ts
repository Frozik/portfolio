import {
  POINTER_PUSH_ACCELERATION,
  POINTER_PUSH_RADIUS,
  pointerPushAcceleration,
} from './pointer-push';

describe('pointerPushAcceleration', () => {
  it('pushes a bob straight away from the pointer', () => {
    const push = pointerPushAcceleration({ x: 0, y: 0 }, { x: 30, y: 40 });

    expect(push.x / push.y).toBeCloseTo(30 / 40);
    expect(push.x).toBeGreaterThan(0);
  });

  it('fades linearly from full strength at the pointer to nothing at the radius', () => {
    const halfway = pointerPushAcceleration({ x: 0, y: 0 }, { x: POINTER_PUSH_RADIUS / 2, y: 0 });

    expect(halfway.x).toBeCloseTo(POINTER_PUSH_ACCELERATION / 2);
    expect(pointerPushAcceleration({ x: 0, y: 0 }, { x: POINTER_PUSH_RADIUS, y: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('has no direction to push a bob sitting exactly on the pointer', () => {
    expect(pointerPushAcceleration({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 0, y: 0 });
  });
});
