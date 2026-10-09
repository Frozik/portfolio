import { MINUTES_PER_HOUR, SECONDS_PER_MINUTE } from '@frozik/utils/date/constants';

export const DIAL_SIZE = 200;
export const DIAL_CENTER = DIAL_SIZE / 2;

const FULL_TURN_DEGREES = 360;
const HOURS_ON_DIAL = 12;
const DEGREES_TO_RADIANS = Math.PI / 180;

const ARC_CENTER_Y = 126;
const ARC_RADIUS = 70;

export interface IDialPoint {
  readonly x: number;
  readonly y: number;
}

export interface IClockHands {
  readonly hourDegrees: number;
  readonly minuteDegrees: number;
  readonly secondDegrees: number;
}

export function clockHands(hour: number, minute: number, second: number): IClockHands {
  const minutes = minute + second / SECONDS_PER_MINUTE;
  return {
    hourDegrees:
      (((hour % HOURS_ON_DIAL) + minutes / MINUTES_PER_HOUR) / HOURS_ON_DIAL) * FULL_TURN_DEGREES,
    minuteDegrees: (minutes / MINUTES_PER_HOUR) * FULL_TURN_DEGREES,
    secondDegrees: (second / SECONDS_PER_MINUTE) * FULL_TURN_DEGREES,
  };
}

export function pointAtAngle(degrees: number, radius: number): IDialPoint {
  const radians = degrees * DEGREES_TO_RADIANS;
  return {
    x: DIAL_CENTER + radius * Math.sin(radians),
    y: DIAL_CENTER - radius * Math.cos(radians),
  };
}

export function arcPoint(progress: number): IDialPoint {
  const angle = Math.PI * progress;
  return {
    x: DIAL_CENTER - ARC_RADIUS * Math.cos(angle),
    y: ARC_CENTER_Y - ARC_RADIUS * Math.sin(angle),
  };
}
