import { isNil } from 'lodash-es';

import type { IMark } from '../../core/series/mark';
import { valueRangeOfElements } from '../../core/series/mark';
import type { TFigure } from './figures';

export interface IMarkerMarkOptions {
  readonly figure: TFigure;
}

const DEFAULT_OPTIONS: IMarkerMarkOptions = { figure: 'circle' };

function isMarkerOptions(options: unknown): options is Partial<IMarkerMarkOptions> {
  return typeof options === 'object' && !isNil(options);
}

/** The options a use of the mark carries, with what it left out filled in. */
export function markerOptionsOf(options: unknown): IMarkerMarkOptions {
  return isMarkerOptions(options) ? { ...DEFAULT_OPTIONS, ...options } : DEFAULT_OPTIONS;
}

/** A figure on every element; on each of a candle's four points (§5.3, §5.4). */
export const MARKER_MARK: IMark = {
  id: 'marker',
  shapes: ['point', 'candle'],
  valueRange: valueRangeOfElements,
  painters: {},
};
