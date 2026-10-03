import type { IAxisTick, ITickGenerator } from '../../core/frame/ticks';
import { laidOut } from './laid-out';

const DECIMAL = 10;
/** Within a decade the ticks stand at these multiples of its start; fewer of them when decades are crowded. */
const DENSE_MULTIPLIERS = [1, 2, 5] as const;
const SPARSE_MULTIPLIERS = [1] as const;
const DENSE_UP_TO_DECADES = 3;
const DEFAULT_LABEL_SIZE_PX = 20;
const MIN_LABEL_GAP_PX = 10;
const MAX_DECIMALS = 8;

function label(value: number): string {
  const decimals = Math.min(MAX_DECIMALS, Math.max(0, -Math.floor(Math.log10(value))));
  return value.toFixed(decimals);
}

/** Ticks of a logarithmic value scale: at 1, 2 and 5 of every power of ten, or at the powers alone when there are many. */
export function logTicks(): ITickGenerator<number> {
  const minGapPx = DEFAULT_LABEL_SIZE_PX + MIN_LABEL_GAP_PX;

  return {
    ticks(axis): readonly IAxisTick<number>[] {
      const { start, end } = axis.range;
      if (!(start > 0) || !(end > start)) {
        return [];
      }
      const firstDecade = Math.floor(Math.log10(start));
      const lastDecade = Math.ceil(Math.log10(end));
      const multipliers =
        lastDecade - firstDecade <= DENSE_UP_TO_DECADES ? DENSE_MULTIPLIERS : SPARSE_MULTIPLIERS;
      const candidates: number[] = [];
      for (let decade = firstDecade; decade <= lastDecade; decade += 1) {
        for (const multiplier of multipliers) {
          const position = multiplier * DECIMAL ** decade;
          if (position >= start && position <= end) {
            candidates.push(position);
          }
        }
      }
      return laidOut(candidates, axis, minGapPx, (_, shown) => ({ label: label(shown), rank: 0 }));
    },
    format(position): string {
      if (!(position > 0)) {
        return String(position);
      }
      const decimals = Math.min(MAX_DECIMALS, Math.max(0, 2 - Math.floor(Math.log10(position))));
      return position.toFixed(decimals);
    },
  };
}
