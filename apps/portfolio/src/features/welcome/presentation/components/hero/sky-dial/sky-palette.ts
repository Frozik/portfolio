import { clamp } from 'lodash-es';

import type { TRgb } from '../../../../../../shared/lib/cssRgbToken';
import type { ISkyState } from '../../../../domain/sky-state';

interface IColorStop {
  readonly altitude: number;
  readonly color: TRgb;
}

export type TSurface = 'snow' | 'rock';

export interface ISkyColors {
  readonly zenith: string;
  readonly horizon: string;
}

const ZENITH_STOPS: readonly IColorStop[] = [
  { altitude: -18, color: [7, 11, 26] },
  { altitude: -12, color: [11, 20, 48] },
  { altitude: -6, color: [24, 35, 73] },
  { altitude: -2, color: [42, 61, 110] },
  { altitude: 2, color: [60, 100, 168] },
  { altitude: 8, color: [79, 134, 204] },
  { altitude: 20, color: [63, 127, 208] },
];
const HORIZON_STOPS: readonly IColorStop[] = [
  { altitude: -18, color: [18, 26, 51] },
  { altitude: -12, color: [35, 40, 77] },
  { altitude: -6, color: [90, 63, 107] },
  { altitude: -2, color: [217, 115, 90] },
  { altitude: 2, color: [242, 160, 102] },
  { altitude: 8, color: [200, 214, 232] },
  { altitude: 20, color: [207, 224, 242] },
];
const SUNLIGHT_STOPS: readonly IColorStop[] = [
  { altitude: -4, color: [255, 70, 90] },
  { altitude: -1, color: [255, 85, 60] },
  { altitude: 2, color: [255, 120, 40] },
  { altitude: 6, color: [255, 170, 80] },
  { altitude: 14, color: [255, 225, 180] },
  { altitude: 30, color: [255, 248, 238] },
  { altitude: 45, color: [255, 255, 255] },
];
const AMBIENT_STOPS: readonly IColorStop[] = [
  { altitude: -18, color: [26, 32, 62] },
  { altitude: -10, color: [36, 40, 74] },
  { altitude: -4, color: [58, 56, 92] },
  { altitude: 0, color: [70, 72, 108] },
  { altitude: 6, color: [110, 120, 155] },
  { altitude: 15, color: [140, 155, 185] },
  { altitude: 30, color: [155, 170, 198] },
];

const MOONLIGHT: TRgb = [95, 125, 200];
const SURFACE_ALBEDO: Readonly<Record<TSurface, TRgb>> = {
  snow: [240, 244, 250],
  rock: [92, 97, 112],
};

interface ILightReach {
  readonly firstLightAltitude: number;
  readonly fullLightAltitude: number;
}

// Summits stand above the observer's horizon, so they catch the Sun while it is still a few degrees under it.
const SUN_REACH: ILightReach = { firstLightAltitude: -4, fullLightAltitude: 20 };
const MOON_REACH: ILightReach = { firstLightAltitude: -1, fullLightAltitude: 30 };
const SUN_FADE_START = -5;
const SUN_FADE_FULL = -1;
const MOON_FADE_START = -1.5;
const MOON_FADE_FULL = 3;
// Under 1, so lit snow keeps its shading instead of clipping to flat white.
const SUNLIGHT_STRENGTH = 0.75;
const MOONLIGHT_STRENGTH = 0.65;
const LIGHT_LINE_SOFTNESS = 0.06;
const MIN_FACING = 0.15;
const MOON_NIGHT_START = -2;
const MOON_NIGHT_FULL = -8;
const MAX_HAZE = 0.45;
const CHANNEL_MAX = 255;
const DEGREES_TO_RADIANS = Math.PI / 180;

const STARS_APPEAR_ALTITUDE = -6;
const STARS_FULL_ALTITUDE = -14;

export function skyColors(sunAltitude: number): ISkyColors {
  return {
    zenith: toCss(colorAt(ZENITH_STOPS, sunAltitude)),
    horizon: toCss(colorAt(HORIZON_STOPS, sunAltitude)),
  };
}

export function starVisibility(sunAltitude: number): number {
  return smoothstep(STARS_APPEAR_ALTITUDE, STARS_FULL_ALTITUDE, sunAltitude);
}

export function surfaceColor({
  sky,
  surface,
  faceAzimuthDegrees,
  elevation,
  depth,
}: {
  readonly sky: ISkyState;
  readonly surface: TSurface;
  readonly faceAzimuthDegrees: number;
  readonly elevation: number;
  readonly depth: number;
}): string {
  const sunAltitude = sky.sun.altitudeDegrees;
  const sunReach = reachAt({
    altitude: sunAltitude,
    azimuth: sky.sun.azimuthDegrees,
    reach: SUN_REACH,
    faceAzimuthDegrees,
    elevation,
  });
  const moonReach = reachAt({
    altitude: sky.moon.altitudeDegrees,
    azimuth: sky.moon.azimuthDegrees,
    reach: MOON_REACH,
    faceAzimuthDegrees,
    elevation,
  });
  const direct =
    SUNLIGHT_STRENGTH * smoothstep(SUN_FADE_START, SUN_FADE_FULL, sunAltitude) * sunReach;
  const moon =
    MOONLIGHT_STRENGTH *
    sky.moon.illumination *
    smoothstep(MOON_FADE_START, MOON_FADE_FULL, sky.moon.altitudeDegrees) *
    smoothstep(MOON_NIGHT_START, MOON_NIGHT_FULL, sunAltitude) *
    moonReach;

  const light = addRgb(
    colorAt(AMBIENT_STOPS, sunAltitude),
    scaleRgb(colorAt(SUNLIGHT_STOPS, sunAltitude), direct),
    scaleRgb(MOONLIGHT, moon)
  );
  const albedo = SURFACE_ALBEDO[surface];
  const shaded: TRgb = [
    (albedo[0] * light[0]) / CHANNEL_MAX,
    (albedo[1] * light[1]) / CHANNEL_MAX,
    (albedo[2] * light[2]) / CHANNEL_MAX,
  ];
  return toCss(mixRgb(shaded, colorAt(HORIZON_STOPS, sunAltitude), depth * MAX_HAZE));
}

export function sunDiscColor(sunAltitude: number): string {
  return toCss(colorAt(SUNLIGHT_STOPS, sunAltitude));
}

function reachAt({
  altitude,
  azimuth,
  reach,
  faceAzimuthDegrees,
  elevation,
}: {
  readonly altitude: number;
  readonly azimuth: number;
  readonly reach: ILightReach;
  readonly faceAzimuthDegrees: number;
  readonly elevation: number;
}): number {
  const climbed = clamp(
    (altitude - reach.firstLightAltitude) / (reach.fullLightAltitude - reach.firstLightAltitude),
    0,
    1
  );
  const lightLine = 1 - climbed;
  const lit = smoothstep(
    lightLine - LIGHT_LINE_SOFTNESS,
    lightLine + LIGHT_LINE_SOFTNESS,
    elevation
  );
  const facing = Math.max(
    MIN_FACING,
    Math.cos((azimuth - faceAzimuthDegrees) * DEGREES_TO_RADIANS)
  );
  return lit * facing;
}

function colorAt(stops: readonly IColorStop[], altitude: number): TRgb {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (altitude <= first.altitude) {
    return first.color;
  }
  if (altitude >= last.altitude) {
    return last.color;
  }
  const upperIndex = stops.findIndex(stop => stop.altitude >= altitude);
  const lower = stops[upperIndex - 1];
  const upper = stops[upperIndex];
  return mixRgb(
    lower.color,
    upper.color,
    (altitude - lower.altitude) / (upper.altitude - lower.altitude)
  );
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mixRgb(from: TRgb, to: TRgb, fraction: number): TRgb {
  return [
    from[0] + (to[0] - from[0]) * fraction,
    from[1] + (to[1] - from[1]) * fraction,
    from[2] + (to[2] - from[2]) * fraction,
  ];
}

function scaleRgb(color: TRgb, factor: number): TRgb {
  return [color[0] * factor, color[1] * factor, color[2] * factor];
}

function addRgb(...colors: readonly TRgb[]): TRgb {
  return colors.reduce<TRgb>(
    (sum, color) => [sum[0] + color[0], sum[1] + color[1], sum[2] + color[2]],
    [0, 0, 0]
  );
}

function toCss(color: TRgb): string {
  const [red, green, blue] = color.map(channel => Math.round(clamp(channel, 0, CHANNEL_MAX)));
  return `rgb(${red} ${green} ${blue})`;
}
