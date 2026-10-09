import { memo } from 'react';

import type { IDialPoint } from './dial-geometry';
import { MOON_CRATERS, MOON_MARIA, TYCHO, TYCHO_RAY_ENDS } from './moon-art';
import { moonLitPath } from './moon-phase';

const SUN_CORE_RADIUS = 5;
const SUN_CORONA_RADIUS = 10;
const SUN_HALO_RADIUS = 24;
const MOON_RADIUS = 7.5;
const MOON_HALO_RADIUS = 20;
const EARTHSHINE_AT_NIGHT = 0.14;
const MOON_HALO_STRENGTH = 0.5;
const DAYTIME_HALO_SHARE = 0.25;

export const Sun = memo(
  ({
    at,
    color,
    idPrefix,
  }: {
    readonly at: IDialPoint;
    readonly color: string;
    readonly idPrefix: string;
  }) => (
    <g>
      <defs>
        <radialGradient id={`${idPrefix}-sun-halo`}>
          <stop offset="0" stopColor={color} stopOpacity={0.55} />
          <stop offset="0.35" stopColor={color} stopOpacity={0.2} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${idPrefix}-sun-corona`}>
          <stop offset="0" stopColor="white" stopOpacity={0.95} />
          <stop offset="0.45" stopColor={color} stopOpacity={0.7} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${idPrefix}-sun-core`}>
          <stop offset="0" stopColor="white" />
          <stop offset="0.6" stopColor="rgb(255 250 235)" />
          <stop offset="1" stopColor={color} />
        </radialGradient>
      </defs>
      <circle cx={at.x} cy={at.y} r={SUN_HALO_RADIUS} fill={`url(#${idPrefix}-sun-halo)`} />
      <circle cx={at.x} cy={at.y} r={SUN_CORONA_RADIUS} fill={`url(#${idPrefix}-sun-corona)`} />
      <circle cx={at.x} cy={at.y} r={SUN_CORE_RADIUS} fill={`url(#${idPrefix}-sun-core)`} />
    </g>
  )
);

export const Moon = memo(
  ({
    at,
    illumination,
    isWaxing,
    darkness,
    idPrefix,
  }: {
    readonly at: IDialPoint;
    readonly illumination: number;
    readonly isWaxing: boolean;
    readonly darkness: number;
    readonly idPrefix: string;
  }) => (
    <g>
      <defs>
        <radialGradient id={`${idPrefix}-moon-halo`}>
          <stop
            offset="0"
            stopColor="rgb(185 208 255)"
            stopOpacity={
              MOON_HALO_STRENGTH *
              illumination *
              (DAYTIME_HALO_SHARE + (1 - DAYTIME_HALO_SHARE) * darkness)
            }
          />
          <stop offset="1" stopColor="rgb(185 208 255)" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${idPrefix}-moon-disc`} cx="0.45" cy="0.42" r="0.6">
          <stop offset="0" stopColor="rgb(242 246 252)" />
          <stop offset="0.75" stopColor="rgb(214 222 236)" />
          <stop offset="1" stopColor="rgb(176 188 208)" />
        </radialGradient>
        <filter id={`${idPrefix}-moon-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.035" />
        </filter>
        <mask id={`${idPrefix}-moon-phase`}>
          <circle r={1} fill="white" opacity={EARTHSHINE_AT_NIGHT * darkness} />
          <path
            d={moonLitPath(0, 0, 1, illumination, isWaxing)}
            fill="white"
            filter={`url(#${idPrefix}-moon-soft)`}
          />
        </mask>
      </defs>
      <circle cx={at.x} cy={at.y} r={MOON_HALO_RADIUS} fill={`url(#${idPrefix}-moon-halo)`} />
      <g
        transform={`translate(${at.x} ${at.y}) scale(${MOON_RADIUS})`}
        mask={`url(#${idPrefix}-moon-phase)`}
      >
        <circle r={1} fill={`url(#${idPrefix}-moon-disc)`} />
        <g filter={`url(#${idPrefix}-moon-soft)`} fill="rgb(128 140 162)" opacity={0.62}>
          {MOON_MARIA.map(patch => (
            <ellipse
              key={patch.name}
              cx={patch.x}
              cy={patch.y}
              rx={patch.radiusX}
              ry={patch.radiusY}
              transform={`rotate(${patch.rotationDegrees} ${patch.x} ${patch.y})`}
            />
          ))}
        </g>
        <g stroke="white" strokeOpacity={0.28} strokeWidth={0.018} strokeLinecap="round">
          {TYCHO_RAY_ENDS.map(([x, y]) => (
            <line key={`${x}:${y}`} x1={TYCHO.x} y1={TYCHO.y} x2={x} y2={y} />
          ))}
        </g>
        {MOON_CRATERS.map(crater => (
          <circle
            key={crater.name}
            cx={crater.x}
            cy={crater.y}
            r={crater.radius}
            fill={crater.tone === 'bright' ? 'rgb(250 252 255)' : 'rgb(110 120 140)'}
            stroke="rgb(90 100 120)"
            strokeOpacity={0.5}
            strokeWidth={0.012}
          />
        ))}
      </g>
    </g>
  )
);
