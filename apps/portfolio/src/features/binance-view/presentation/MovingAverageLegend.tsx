import type React from 'react';

import {
  MOVING_AVERAGE_LONG_COLOR,
  MOVING_AVERAGE_LONG_PERIOD,
  MOVING_AVERAGE_SHORT_COLOR,
  MOVING_AVERAGE_SHORT_PERIOD,
} from '../domain/constants';

import { binanceT } from './translations';

const MOVING_AVERAGE_LINES = [
  { period: MOVING_AVERAGE_SHORT_PERIOD, color: MOVING_AVERAGE_SHORT_COLOR },
  { period: MOVING_AVERAGE_LONG_PERIOD, color: MOVING_AVERAGE_LONG_COLOR },
] as const;

/** Key for the moving-average lines drawn over the candles, in the plot's top-left corner. */
export function MovingAverageLegend(): React.ReactElement {
  return (
    <ul
      aria-label={binanceT.legend.movingAverages}
      className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1 rounded-md bg-surface-elevated/70 px-2 py-1 font-mono text-[11px] text-text-secondary backdrop-blur-sm"
    >
      {MOVING_AVERAGE_LINES.map(line => (
        <li key={line.period} className="flex items-center gap-1.5">
          {/* The swatch takes the colour the shader is compiled with, so the two never drift. */}
          <span
            aria-hidden
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ backgroundColor: line.color }}
          />
          <span>{binanceT.legend.movingAverage(line.period)}</span>
        </li>
      ))}
    </ul>
  );
}
