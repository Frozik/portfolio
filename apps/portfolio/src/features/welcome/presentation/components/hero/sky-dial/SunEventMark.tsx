import { memo } from 'react';

import type { TSunEventKind } from '../../../../domain/sky-state';
import { DIAL_CENTER } from './dial-geometry';

const MARK_Y = 152;
const GLYPH_OFFSET_X = -14;
const TIME_OFFSET_X = -4;
const HORIZON_HALF_WIDTH = 6;
const SUN_RADIUS = 3.6;
const ARROW_HALF_WIDTH = 2;
const ARROW_NEAR = -5.2;
const ARROW_FAR = -7.8;
const MARK_COLOR = 'rgb(255 190 120)';
const BACKDROP_COLOR = 'rgb(7 9 12 / 0.5)';

export const SunEventMark = memo(
  ({ kind, time }: { readonly kind: TSunEventKind; readonly time: string }) => {
    const arrow =
      kind === 'sunrise'
        ? `M ${-ARROW_HALF_WIDTH} ${ARROW_NEAR} L 0 ${ARROW_FAR} L ${ARROW_HALF_WIDTH} ${ARROW_NEAR}`
        : `M ${-ARROW_HALF_WIDTH} ${ARROW_FAR} L 0 ${ARROW_NEAR} L ${ARROW_HALF_WIDTH} ${ARROW_FAR}`;

    return (
      <g transform={`translate(${DIAL_CENTER} ${MARK_Y})`}>
        <rect x={-24} y={-11} width={50} height={16} rx={8} fill={BACKDROP_COLOR} />
        <g
          transform={`translate(${GLYPH_OFFSET_X} 1)`}
          fill="none"
          stroke={MARK_COLOR}
          strokeWidth={1.1}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1={-HORIZON_HALF_WIDTH} y1={0} x2={HORIZON_HALF_WIDTH} y2={0} />
          <path d={`M ${-SUN_RADIUS} 0 A ${SUN_RADIUS} ${SUN_RADIUS} 0 0 1 ${SUN_RADIUS} 0`} />
          <path d={arrow} />
        </g>
        <text
          x={TIME_OFFSET_X}
          y={-2.5}
          dominantBaseline="central"
          fontSize={8}
          fill="rgb(231 236 243)"
          className="font-mono tabular-nums"
        >
          {time}
        </text>
      </g>
    );
  }
);
