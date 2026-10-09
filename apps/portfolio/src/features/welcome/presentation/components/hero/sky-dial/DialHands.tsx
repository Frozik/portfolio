import { memo } from 'react';

import { DIAL_CENTER } from './dial-geometry';
import type { IClockHands } from './dial-geometry';

const HOUR_HAND = handPath({ halfWidth: 4.4, tail: 7, shoulder: 30, tip: 42 });
const HOUR_LUME = handPath({ halfWidth: 1.6, tail: -10, shoulder: 29, tip: 35 });
const MINUTE_HAND = handPath({ halfWidth: 3.4, tail: 8, shoulder: 54, tip: 66 });
const MINUTE_LUME = handPath({ halfWidth: 1.2, tail: -12, shoulder: 53, tip: 59 });
function handPath({
  halfWidth,
  tail,
  shoulder,
  tip,
}: {
  readonly halfWidth: number;
  readonly tail: number;
  readonly shoulder: number;
  readonly tip: number;
}): string {
  const left = DIAL_CENTER - halfWidth;
  const right = DIAL_CENTER + halfWidth;
  return `M ${left} ${DIAL_CENTER + tail} L ${left} ${DIAL_CENTER - shoulder} L ${DIAL_CENTER} ${DIAL_CENTER - tip} L ${right} ${DIAL_CENTER - shoulder} L ${right} ${DIAL_CENTER + tail} Z`;
}

const SECOND_TIP = 72;
const SECOND_TAIL = 16;
const SECOND_RING_DISTANCE = 56;
const SECOND_RING_RADIUS = 3.2;
const SECOND_COUNTERWEIGHT_RADIUS = 2.4;
const HAND_COLOR = 'rgb(231 236 243)';
const HAND_EDGE_COLOR = 'rgb(7 9 12 / 0.55)';
const LUME_COLOR = 'rgb(96 165 250)';
const SECOND_COLOR = 'rgb(255 122 69)';

export const DialHands = memo(
  ({ hands, shadowFilterId }: { readonly hands: IClockHands; readonly shadowFilterId: string }) => (
    <g filter={`url(#${shadowFilterId})`}>
      <g transform={`rotate(${hands.hourDegrees} ${DIAL_CENTER} ${DIAL_CENTER})`}>
        <path d={HOUR_HAND} fill={HAND_COLOR} stroke={HAND_EDGE_COLOR} strokeWidth={0.6} />
        <path d={HOUR_LUME} fill={LUME_COLOR} />
      </g>
      <g transform={`rotate(${hands.minuteDegrees} ${DIAL_CENTER} ${DIAL_CENTER})`}>
        <path d={MINUTE_HAND} fill={HAND_COLOR} stroke={HAND_EDGE_COLOR} strokeWidth={0.6} />
        <path d={MINUTE_LUME} fill={LUME_COLOR} />
      </g>
      <g transform={`rotate(${hands.secondDegrees} ${DIAL_CENTER} ${DIAL_CENTER})`}>
        <line
          x1={DIAL_CENTER}
          y1={DIAL_CENTER + SECOND_TAIL}
          x2={DIAL_CENTER}
          y2={DIAL_CENTER - SECOND_TIP}
          stroke={SECOND_COLOR}
          strokeWidth={0.8}
          strokeLinecap="round"
        />
        <circle
          cx={DIAL_CENTER}
          cy={DIAL_CENTER - SECOND_RING_DISTANCE}
          r={SECOND_RING_RADIUS}
          fill="rgb(7 9 12 / 0.35)"
          stroke={SECOND_COLOR}
          strokeWidth={0.9}
        />
        <circle
          cx={DIAL_CENTER}
          cy={DIAL_CENTER + SECOND_TAIL - 2}
          r={SECOND_COUNTERWEIGHT_RADIUS}
          fill={SECOND_COLOR}
        />
      </g>
      <circle cx={DIAL_CENTER} cy={DIAL_CENTER} r={3.6} fill={HAND_COLOR} />
      <circle cx={DIAL_CENTER} cy={DIAL_CENTER} r={1.5} fill={SECOND_COLOR} />
    </g>
  )
);
