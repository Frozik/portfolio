import { clamp, isNil, range } from 'lodash-es';
import { memo, useId } from 'react';

import type { ISkyState } from '../../../../domain/sky-state';
import { clockHands, DIAL_CENTER, DIAL_SIZE, pointAtAngle, arcPoint } from './dial-geometry';
import { DialHands } from './DialHands';
import { FOOT_Y, MOUNTAIN_FACES, ROCK_RIBS, STARS, SUMMIT_Y } from './mountain-art';
import type { IMountainFace } from './mountain-art';
import { skyColors, starVisibility, sunDiscColor, surfaceColor } from './sky-palette';
import { Moon, Sun } from './SkyBodies';
import { SunEventMark } from './SunEventMark';

const SCENE_RADIUS = 80;
const BEZEL_RADIUS = 99;
const NUMERAL_RADIUS = 90;
const MINUTE_TICK_OUTER = 83.5;
const MINUTE_TICK_INNER = 82;
const HOUR_TICK_INNER = 80.5;
const HOURS_ON_DIAL = 12;
const MINUTES_ON_DIAL = 60;
const DEGREES_PER_HOUR = 30;
const DEGREES_PER_MINUTE = 6;
const MINUTES_PER_HOUR_MARK = 5;
const GRADIENT_ELEVATION_STEPS = 8;
const ROCK_RIB_OPACITY = 0.22;
const STAR_RADIUS = 0.7;

export interface IDialTime {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

export const SkyDial = memo(
  ({
    sky,
    time,
    nextEventTime,
    label,
  }: {
    readonly sky: ISkyState;
    readonly time: IDialTime;
    readonly nextEventTime: string | undefined;
    readonly label: string;
  }) => {
    const idPrefix = `sky${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
    const colors = skyColors(sky.sun.altitudeDegrees);
    const sunAt = isNil(sky.sunArc) ? undefined : arcPoint(sky.sunArc);
    const moonAt = isNil(sky.moonArc) ? undefined : arcPoint(sky.moonArc);

    return (
      <svg
        viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
        role="img"
        aria-label={label}
        className="block size-full"
      >
        <defs>
          <clipPath id={`${idPrefix}-scene`}>
            <circle cx={DIAL_CENTER} cy={DIAL_CENTER} r={SCENE_RADIUS} />
          </clipPath>
          <linearGradient id={`${idPrefix}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={colors.zenith} />
            <stop offset="0.7" stopColor={colors.horizon} />
          </linearGradient>
          <radialGradient id={`${idPrefix}-bezel`}>
            <stop offset="0.8" stopColor="rgb(18 22 30)" />
            <stop offset="1" stopColor="rgb(7 9 12)" />
          </radialGradient>
          <filter id={`${idPrefix}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0.8"
              dy="1.4"
              stdDeviation="1"
              floodColor="black"
              floodOpacity="0.55"
            />
          </filter>
          {MOUNTAIN_FACES.map(face => (
            <FaceGradient key={face.id} id={`${idPrefix}-${face.id}`} face={face} sky={sky} />
          ))}
        </defs>

        <circle
          cx={DIAL_CENTER}
          cy={DIAL_CENTER}
          r={BEZEL_RADIUS}
          fill={`url(#${idPrefix}-bezel)`}
        />
        <g clipPath={`url(#${idPrefix}-scene)`}>
          <rect width={DIAL_SIZE} height={DIAL_SIZE} fill={`url(#${idPrefix}-sky)`} />
          <g opacity={starVisibility(sky.sun.altitudeDegrees)} fill="white">
            {STARS.map(([x, y]) => (
              <circle key={`${x}:${y}`} cx={x} cy={y} r={STAR_RADIUS} />
            ))}
          </g>
          {!isNil(moonAt) && (
            <Moon
              at={moonAt}
              illumination={sky.moon.illumination}
              isWaxing={sky.moon.isWaxing}
              darkness={starVisibility(sky.sun.altitudeDegrees)}
              idPrefix={idPrefix}
            />
          )}
          {!isNil(sunAt) && (
            <Sun at={sunAt} color={sunDiscColor(sky.sun.altitudeDegrees)} idPrefix={idPrefix} />
          )}
          {MOUNTAIN_FACES.map(face => (
            <path key={face.id} d={face.path} fill={`url(#${idPrefix}-${face.id})`} />
          ))}
          {ROCK_RIBS.map(rib => (
            <path key={rib} d={rib} fill="black" opacity={ROCK_RIB_OPACITY} />
          ))}
        </g>
        <circle
          cx={DIAL_CENTER}
          cy={DIAL_CENTER}
          r={SCENE_RADIUS}
          fill="none"
          stroke="rgb(255 255 255 / 0.12)"
          strokeWidth={0.8}
        />

        {range(MINUTES_ON_DIAL).map(minuteMark => {
          const isHour = minuteMark % MINUTES_PER_HOUR_MARK === 0;
          const angle = minuteMark * DEGREES_PER_MINUTE;
          const inner = pointAtAngle(angle, isHour ? HOUR_TICK_INNER : MINUTE_TICK_INNER);
          const outer = pointAtAngle(angle, MINUTE_TICK_OUTER);
          return (
            <line
              key={minuteMark}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="rgb(231 236 243)"
              strokeOpacity={isHour ? 0.9 : 0.45}
              strokeWidth={isHour ? 1.4 : 0.5}
            />
          );
        })}
        {range(1, HOURS_ON_DIAL + 1).map(hour => {
          const position = pointAtAngle(hour * DEGREES_PER_HOUR, NUMERAL_RADIUS);
          return (
            <text
              key={hour}
              x={position.x}
              y={position.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={9}
              fontWeight={600}
              fill="rgb(162 173 189)"
            >
              {hour}
            </text>
          );
        })}

        {!isNil(sky.nextEvent) && !isNil(nextEventTime) && (
          <SunEventMark kind={sky.nextEvent.kind} time={nextEventTime} />
        )}
        <DialHands
          hands={clockHands(time.hour, time.minute, time.second)}
          shadowFilterId={`${idPrefix}-shadow`}
        />
      </svg>
    );
  }
);

const FaceGradient = memo(
  ({
    id,
    face,
    sky,
  }: {
    readonly id: string;
    readonly face: IMountainFace;
    readonly sky: ISkyState;
  }) => (
    <linearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      x1="0"
      y1={face.top}
      x2="0"
      y2={face.bottom}
    >
      {range(GRADIENT_ELEVATION_STEPS + 1).map(step => {
        const offset = step / GRADIENT_ELEVATION_STEPS;
        const y = face.top + offset * (face.bottom - face.top);
        return (
          <stop
            key={step}
            offset={offset}
            stopColor={surfaceColor({
              sky,
              surface: face.surface,
              faceAzimuthDegrees: face.faceAzimuthDegrees,
              elevation: clamp((FOOT_Y - y) / (FOOT_Y - SUMMIT_Y), 0, 1),
              depth: face.depth,
            })}
          />
        );
      })}
    </linearGradient>
  )
);
