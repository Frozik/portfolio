import type { IMark } from '../../core/series/mark';
import type { IStyleProcessor } from '../../core/series/style-processor';
import type { ILineStyleOptions } from './style';
import { createLineStyle } from './style';

/** A line that holds each value until the next point: "the last known value" of a time series (§5.3). */
export function createStairsStyle<TX>(
  mark: IMark,
  options: ILineStyleOptions<TX> = {}
): IStyleProcessor<TX> {
  return createLineStyle(mark, { join: 'stepAfter', ...options });
}
