import { describe, expect, it } from 'vitest';

import type { ISkyState } from '../../../../domain/sky-state';
import { surfaceColor } from './sky-palette';

const EAST = 90;
const WEST = 270;

function sky({
  sunAltitude,
  sunAzimuth = EAST,
  moonAltitude = -30,
  moonIllumination = 0,
}: {
  readonly sunAltitude: number;
  readonly sunAzimuth?: number;
  readonly moonAltitude?: number;
  readonly moonIllumination?: number;
}): ISkyState {
  return {
    sun: { altitudeDegrees: sunAltitude, azimuthDegrees: sunAzimuth },
    moon: {
      altitudeDegrees: moonAltitude,
      azimuthDegrees: 180,
      illumination: moonIllumination,
      isWaxing: true,
    },
    sunArc: undefined,
    moonArc: undefined,
    nextEvent: undefined,
  };
}

function snowAt(
  state: ISkyState,
  elevation: number,
  faceAzimuthDegrees = EAST
): readonly [number, number, number] {
  const css = surfaceColor({
    sky: state,
    surface: 'snow',
    faceAzimuthDegrees,
    elevation,
    depth: 0,
  });
  const [red, green, blue] = (css.match(/\d+/g) ?? []).map(Number);
  return [red, green, blue];
}

function brightness([red, green, blue]: readonly [number, number, number]): number {
  return red + green + blue;
}

describe('surfaceColor', () => {
  it('lights the summit warm at sunrise while the foot of the face stays in shade', () => {
    const sunrise = sky({ sunAltitude: 1 });
    const summit = snowAt(sunrise, 1);
    const foot = snowAt(sunrise, 0);

    expect(summit[0]).toBeGreaterThan(summit[2] + 40);
    expect(foot[2]).toBeGreaterThanOrEqual(foot[0]);
    expect(brightness(summit)).toBeGreaterThan(brightness(foot));
  });

  it('keeps the face turned away from a rising Sun cold', () => {
    const sunrise = sky({ sunAltitude: 1, sunAzimuth: EAST });

    expect(snowAt(sunrise, 1, EAST)[0]).toBeGreaterThan(snowAt(sunrise, 1, WEST)[0] + 60);
  });

  it('lights the whole face, foot to summit, at midday', () => {
    const noon = sky({ sunAltitude: 50, sunAzimuth: 180 });

    expect(brightness(snowAt(noon, 0, 180))).toBeGreaterThan(600);
    expect(brightness(snowAt(noon, 1, 180))).toBeGreaterThan(600);
  });

  it('lights only the summits under a low moon and the whole face under a high one', () => {
    const lowMoon = sky({ sunAltitude: -30, moonAltitude: 4, moonIllumination: 1 });
    const highMoon = sky({ sunAltitude: -30, moonAltitude: 50, moonIllumination: 1 });

    expect(brightness(snowAt(lowMoon, 1, 180))).toBeGreaterThan(
      brightness(snowAt(lowMoon, 0.2, 180)) + 60
    );
    expect(brightness(snowAt(highMoon, 0.2, 180))).toBeGreaterThan(
      brightness(snowAt(lowMoon, 0.2, 180)) + 60
    );
  });

  it('tints the night snow blue under a high full moon and leaves it dark at new moon', () => {
    const fullMoon = snowAt(
      sky({ sunAltitude: -30, moonAltitude: 50, moonIllumination: 1 }),
      0.5,
      180
    );
    const newMoon = snowAt(
      sky({ sunAltitude: -30, moonAltitude: 50, moonIllumination: 0 }),
      0.5,
      180
    );

    expect(fullMoon[2]).toBeGreaterThan(fullMoon[0] + 30);
    expect(brightness(fullMoon)).toBeGreaterThan(brightness(newMoon) + 100);
  });
});
