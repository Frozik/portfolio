import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import type { JoystickState } from './floating-joystick';
import {
  getKnobOffset,
  JOYSTICK_DEAD_ZONE_RADIUS_PX,
  JOYSTICK_REACH_RADIUS_PX,
  plantJoystick,
  tiltJoystick,
} from './floating-joystick';

const ZONE = { width: 600, height: 800 };
const PRESS: Vector2 = { x: 300, y: 400 };
const PUSH = JOYSTICK_DEAD_ZONE_RADIUS_PX + 10;
const DEGREE = Math.PI / 180;

function tiltBy(state: JoystickState, offset: Vector2): JoystickState {
  return tiltJoystick(state, { x: state.center.x + offset.x, y: state.center.y + offset.y }, ZONE);
}

/** Screen angles: 0° points right, 90° points down. */
function atAngle(degrees: number, distance = PUSH): Vector2 {
  return { x: Math.cos(degrees * DEGREE) * distance, y: Math.sin(degrees * DEGREE) * distance };
}

describe('floating joystick', () => {
  it('stands where the thumb landed and steers nowhere until the thumb moves', () => {
    expect(plantJoystick(PRESS)).toEqual({ center: PRESS, thumb: PRESS, direction: undefined });
  });

  it('steers nowhere while the thumb stays inside the circle around the press', () => {
    const inside = JOYSTICK_DEAD_ZONE_RADIUS_PX - 1;

    expect(tiltBy(plantJoystick(PRESS), { x: inside, y: 0 }).direction).toBeUndefined();
    expect(tiltBy(plantJoystick(PRESS), { x: 0, y: -inside }).direction).toBeUndefined();
  });

  it('drives toward the side the thumb left the circle on', () => {
    const stick = plantJoystick(PRESS);

    expect(tiltBy(stick, { x: PUSH, y: 0 }).direction).toBe('right');
    expect(tiltBy(stick, { x: -PUSH, y: 0 }).direction).toBe('left');
    expect(tiltBy(stick, { x: 0, y: -PUSH }).direction).toBe('up');
    expect(tiltBy(stick, { x: 0, y: PUSH }).direction).toBe('down');
  });

  it('splits the ground around the circle along the diagonals', () => {
    const stick = plantJoystick(PRESS);

    expect(tiltBy(stick, atAngle(-50)).direction).toBe('up');
    expect(tiltBy(stick, atAngle(-40)).direction).toBe('right');
    expect(tiltBy(stick, atAngle(130)).direction).toBe('down');
    expect(tiltBy(stick, atAngle(140)).direction).toBe('left');
  });

  it('keeps the direction while the thumb drifts just across a diagonal', () => {
    const drivingRight = tiltBy(plantJoystick(PRESS), atAngle(0));

    expect(tiltBy(drivingRight, atAngle(-50)).direction).toBe('right');
    expect(tiltBy(drivingRight, atAngle(50)).direction).toBe('right');
  });

  it('turns once the thumb is well past the diagonal', () => {
    const drivingRight = tiltBy(plantJoystick(PRESS), atAngle(0));

    expect(tiltBy(drivingRight, atAngle(-65)).direction).toBe('up');
    expect(tiltBy(drivingRight, atAngle(65)).direction).toBe('down');
    expect(tiltBy(drivingRight, atAngle(180)).direction).toBe('left');
  });

  it('stops when the thumb comes back into the circle and forgets the old direction', () => {
    const drivingRight = tiltBy(plantJoystick(PRESS), atAngle(0));
    const stopped = tiltBy(drivingRight, { x: 0, y: 0 });

    expect(stopped.direction).toBeUndefined();
    expect(tiltBy(stopped, atAngle(-50)).direction).toBe('up');
  });

  it('stays put while the thumb is within reach', () => {
    const tilted = tiltBy(plantJoystick(PRESS), { x: JOYSTICK_REACH_RADIUS_PX, y: 0 });

    expect(tilted.center).toEqual(PRESS);
  });

  it('follows a thumb that outruns its reach, so reversing takes a short move back', () => {
    const farPush = 200;
    const pushedFar = tiltBy(plantJoystick(PRESS), { x: farPush, y: 0 });

    expect(pushedFar.direction).toBe('right');
    expect(pushedFar.center.x).toBeCloseTo(PRESS.x + farPush - JOYSTICK_REACH_RADIUS_PX);
    expect(pushedFar.center.y).toBeCloseTo(PRESS.y);

    const pulledBack = tiltJoystick(
      pushedFar,
      { x: pushedFar.thumb.x - JOYSTICK_REACH_RADIUS_PX - PUSH, y: pushedFar.thumb.y },
      ZONE
    );

    expect(pulledBack.direction).toBe('left');
  });

  it('never follows the thumb across the edge of its zone', () => {
    const acrossTheMiddle = tiltJoystick(plantJoystick(PRESS), { x: -150, y: PRESS.y }, ZONE);

    expect(acrossTheMiddle.center).toEqual({ x: 0, y: PRESS.y });
    expect(acrossTheMiddle.direction).toBe('left');

    const belowTheZone = tiltJoystick(
      plantJoystick(PRESS),
      { x: PRESS.x, y: ZONE.height + 150 },
      ZONE
    );

    expect(belowTheZone.center).toEqual({ x: PRESS.x, y: ZONE.height });
    expect(belowTheZone.direction).toBe('down');
  });

  it('keeps the knob inside the ring while the thumb is further out than the stick can follow', () => {
    const acrossTheMiddle = tiltJoystick(plantJoystick(PRESS), { x: -150, y: PRESS.y }, ZONE);
    const knob = getKnobOffset(acrossTheMiddle);

    expect(knob.x).toBeCloseTo(-JOYSTICK_REACH_RADIUS_PX);
    expect(knob.y).toBeCloseTo(0);
  });

  it('puts the knob under the thumb while the thumb is within reach', () => {
    expect(getKnobOffset(tiltBy(plantJoystick(PRESS), { x: 30, y: -10 }))).toEqual({
      x: 30,
      y: -10,
    });
  });
});
