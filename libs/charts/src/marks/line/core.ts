import { isNil } from 'lodash-es';

import type { IMark } from '../../core/series/mark';
import { valueRangeOfElements } from '../../core/series/mark';

/** How a line gets from point A to point B (§5.3). */
export type TLineJoin = 'linear' | 'stepAfter' | 'stepBefore';

export interface ILineMarkOptions {
  readonly join: TLineJoin;
  /** Which paint draws the line: its own fill, or the stroke when the line is the edge of another mark. */
  readonly paint: 'fill' | 'stroke';
}

const DEFAULT_OPTIONS: ILineMarkOptions = { join: 'linear', paint: 'fill' };

function isLineOptions(options: unknown): options is Partial<ILineMarkOptions> {
  return typeof options === 'object' && !isNil(options);
}

/** The options a use of the mark carries, with what it left out filled in. */
export function lineOptionsOf(options: unknown): ILineMarkOptions {
  return isLineOptions(options) ? { ...DEFAULT_OPTIONS, ...options } : DEFAULT_OPTIONS;
}

export const LINE_MARK: IMark = {
  id: 'line',
  shapes: ['point', 'candle'],
  valueRange: valueRangeOfElements,
  painters: {},
};
